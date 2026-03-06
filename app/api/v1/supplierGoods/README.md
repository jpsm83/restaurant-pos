# Supplier Goods API — `app/api/v1/supplierGoods`

This folder contains the **REST API for the SupplierGood entity**: the catalog of **products a business buys from a supplier**. Each supplier good belongs to one **Supplier** and one **Business**, and describes name, category, units, pricing, and optional images. Supplier goods are the **link between supply and menu**: **BusinessGood** (menu items) reference them as **ingredients**, and **Purchases** record bought quantities by `supplierGoodId`. When a new supplier good is created (and `currentlyInUse` is true), it is **automatically added to the business’s open Inventory** so stock can be tracked.

This document describes how these routes work, how they fit into the app (suppliers, inventory, business goods, purchases), and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **SupplierGood** = one purchasable product from a supplier: e.g. “King Arthur flour”, “Olive oil 5L”, with name, keyword, main/sub category, optional allergens, units, and price per measurement unit.
- **Scoping:** Every supplier good has `supplierId` and `businessId`. Uniqueness is per (business, supplier, name): the same product name can exist under different suppliers or businesses, but not twice for the same supplier within a business.
- **Inventory coupling:** On **create**, if the good is in use (`currentlyInUse: true`, default), the route calls `addSupplierGoodToInventory(supplierGoodId, businessId, session)` so the current month’s inventory gets a new `inventoryGoods` entry with that `supplierGoodId` and `dynamicSystemCount: 0`. On **PATCH**, if `currentlyInUse` is set to true and the good is not yet in the current inventory, it is added. On **DELETE**, the good is removed from the open inventory via `deleteSupplierGoodFromInventory`, then the Cloudinary folder for its images is deleted.
- **Business goods and purchases:** **BusinessGood** ingredients reference `supplierGoodId`; **Purchase** lines reference `supplierGoodId` and use `pricePerMeasurementUnit` and `measurementUnit` for quantities and pricing. Deleting a supplier good is **blocked** if any BusinessGood still uses it as an ingredient.

So: **Supplier goods are the supply-side catalog that connects suppliers to inventory, purchases, and menu (business goods).** Creating/updating them keeps inventory in sync for stock tracking; deleting them is guarded by business-good usage and cleans up inventory and assets.

---

## 2. File structure

```
app/api/v1/supplierGoods/
├── README.md                         # This file — context for flow, patterns, and app integration
├── route.ts                          # GET all supplier goods | POST create supplier good
├── [supplierGoodId]/
│   └── route.ts                      # GET | PATCH | DELETE by supplierGoodId
└── supplier/
    └── [supplierId]/
        └── route.ts                  # GET supplier goods by supplier ID
```

- **`route.ts`** (no dynamic segment): list all supplier goods (with supplier populated); create new supplier good (FormData, optional images, transaction with inventory add).
- **`[supplierGoodId]/route.ts`**: get one, update (PATCH with FormData), delete. PATCH can add the good to inventory when `currentlyInUse` becomes true; DELETE removes from inventory and Cloudinary and is blocked if used in business goods.
- **`supplier/[supplierId]/route.ts`**: list supplier goods for a given supplier (no populate in current implementation).

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/supplierGoods` | Returns all supplier goods; populates `supplierId` (tradeName). 404 if none. |
| POST | `/api/v1/supplierGoods` | Creates a new supplier good. Body: **FormData** (see below). In a transaction: create good, then add to inventory if in use. Optional Cloudinary upload. |
| GET | `/api/v1/supplierGoods/:supplierGoodId` | Returns one supplier good by ID (supplier populated). 404 if not found. |
| PATCH | `/api/v1/supplierGoods/:supplierGoodId` | Partial update. Body: **FormData**. Can add good to current inventory when `currentlyInUse` becomes true. Optional image upload. |
| DELETE | `/api/v1/supplierGoods/:supplierGoodId` | Deletes supplier good only if not used in any BusinessGood; then removes from inventory and deletes Cloudinary folder. Transactional. |
| GET | `/api/v1/supplierGoods/supplier/:supplierId` | Returns supplier goods for the given supplier. 404 if none. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns and validation

### 4.1 GET (list, by ID, by supplier)

- **DB:** `connectDb()` before first query.
- **List:** `SupplierGood.find().populate({ path: "supplierId", select: "tradeName", model: Supplier }).lean()`.
- **By ID:** Validate `supplierGoodId` with `isObjectIdValid`; then `findById(supplierGoodId)` with same populate.
- **By supplier:** Validate `supplierId`; `SupplierGood.find({ supplierId }).lean()` (no populate in current code).
- **Response:** 200 + JSON array or single object; 404 with `{ message: "..." }` when no data or invalid ID.

### 4.2 POST (create) — FormData + transaction

**Required fields (FormData):**

- `name`, `keyword`, `mainCategory`, `supplierId`, `businessId`

**Optional:**

- `subCategory`, `description`, `allergens` (JSON string array), `budgetImpact`, `inventorySchedule`, `minimumQuantityRequired`, `parLevel`, `purchaseUnit`, `measurementUnit`, `quantityInMeasurementUnit`, `totalPurchasePrice`, `imagesUrl` (files; max 3).

**Validation:**

- `businessId` and `supplierId` validated with `isObjectIdValid`.
- `mainCategory` must be in `mainCategoriesEnums`.
- Each `allergen` (if provided) must be in `allergensEnums`.
- Duplicate check: `SupplierGood.exists({ businessId, supplierId, name })`; on duplicate return 400.

**Price:** If both `totalPurchasePrice` and `quantityInMeasurementUnit` are provided, `pricePerMeasurementUnit` is set to `totalPurchasePrice / quantityInMeasurementUnit` (used by purchases and analytics).

**Transaction:**

1. Check duplicate.
2. Generate `_id` for the new good.
3. If non-empty image files (max 3): upload to Cloudinary folder `/business/:businessId/suppliersGoods/:supplierGoodId`, set `imagesUrl` on the document.
4. Create the supplier good with `SupplierGood.create([newSupplierGoodObj], { session })`.
5. Call `addSupplierGoodToInventory(supplierGoodId, businessId, session)` (good is created with `currentlyInUse: true` by default).
6. Commit.

If any step fails, the transaction is aborted and the session ended in `finally`.

### 4.3 PATCH (update) — FormData + optional inventory add

**Required fields (FormData):** `name`, `keyword`, `mainCategory`.  
**Optional:** `currentlyInUse` (string `"true"`/`"false"`), plus the same optional fields as POST. **Images:** `imagesUrl` (files); total images (existing + new) must not exceed 3.

**Validation:** Same enum checks as POST. Duplicate check excludes current document: `SupplierGood.exists({ _id: { $ne: supplierGoodId }, businessId, supplierId, name })`; on duplicate return 409.

**Price:** When both `totalPurchasePrice` and `quantityInMeasurementUnit` are sent and differ from existing, `pricePerMeasurementUnit` is recalculated as in POST.

**Inventory:** If `currentlyInUse === true`, the route checks whether the good is already in the **current month’s** open inventory (`setFinalCount: false`, `createdAt` in current month, and `inventoryGoods.supplierGoodId` matches). If not, it calls `addSupplierGoodToInventory(supplierGoodId, businessId, session)` within the same transaction. So toggling a good back to “in use” can add it to the active inventory.

**Images:** New files are uploaded to the same Cloudinary folder; `imagesUrl` is set to `[...(existing images), ...newUrls]`. Max 3 total.

### 4.4 DELETE — guarded by BusinessGood usage + inventory + Cloudinary

- Validate `supplierGoodId`; load supplier good (at least `businessId`).
- **Guard:** `BusinessGood.exists({ businessId, "ingredients.supplierGoodId": supplierGoodId })`. If true, return 409 “Supplier good is in use in some business goods!” and do not delete.
- In a transaction:
  1. Delete the supplier good document.
  2. Call `deleteSupplierGoodFromInventory(supplierGoodId, businessId, session)` to remove it from the open inventory’s `inventoryGoods` array.
  3. Call `deleteFolderCloudinary(folderPath)` where `folderPath = /business/:businessId/suppliersGoods/:supplierGoodId`.
- Commit. If Cloudinary fails, the transaction is aborted (DB and Cloudinary stay consistent: good is only deleted when both DB and cleanup succeed in the intended flow; current code aborts on Cloudinary failure).

**Note:** Comment in code states that deleting supplier goods is generally discouraged for data integrity and analytics; the only “normal” deletion is when the business itself is deleted (cascade). The DELETE route exists for exceptional cases.

---

## 5. Enums and units

From `lib/enums`:

- **mainCategoriesEnums:** Used for `mainCategory` (required).
- **allergensEnums:** Used for each entry in `allergens` array.
- **budgetImpactEnums, inventoryScheduleEnums:** Used for `budgetImpact`, `inventorySchedule`.
- **purchaseUnitEnums, measurementUnitEnums:** Used for `purchaseUnit`, `measurementUnit`.

**Units and pricing (from model comments):**

- **purchaseUnit:** How the good is sold by the supplier (e.g. box, carton, unit, bag).
- **measurementUnit:** Unit used for conversion and stock (e.g. kilogram, liter, unit).
- **quantityInMeasurementUnit:** Quantity per purchase unit (e.g. 20 kg per box).
- **totalPurchasePrice:** Price for that purchase unit.
- **pricePerMeasurementUnit:** Computed as `totalPurchasePrice / quantityInMeasurementUnit` (e.g. €2 per kg). Used in purchases and reporting.

**parLevel** is expressed in the **measurement unit** (e.g. “order up to 100 kg”).

---

## 6. How other parts of the app use Supplier Goods

### 6.1 Suppliers

- Every supplier good has a required `supplierId`. Suppliers are created and managed under `app/api/v1/suppliers`. Listing goods by supplier (`GET /supplierGoods/supplier/:supplierId`) supports supplier-centric views and purchase flows.

### 6.2 Inventory

- **Inventories** hold `inventoryGoods[]` with `supplierGoodId` and `dynamicSystemCount`. When a supplier good is created (and in use) or toggled back to in use on PATCH, it is added to the **current month’s open inventory** via `addSupplierGoodToInventory`. When a supplier good is deleted, it is removed from that inventory via `deleteSupplierGoodFromInventory`. These utils live under `app/api/v1/inventories/utils/`.

### 6.3 Business goods (menu / ingredients)

- **BusinessGood** represents a sellable item (dish/drink). Its `ingredients[]` array references `supplierGoodId` and quantities. DELETE supplier good is **blocked** if any BusinessGood still references it, to avoid broken recipes and cost calculations.

### 6.4 Purchases

- **Purchase** lines (`purchaseInventoryItems`) store `supplierGoodId`, `quantityPurchased` (in the supplier good’s **measurement unit**), and `purchasePrice`. Purchases drive inventory `dynamicSystemCount` increases. The purchases API populates `purchaseInventoryItems.supplierGoodId` with fields like `name`, `mainCategory`, `subCategory`, `measurementUnit`, `pricePerMeasurementUnit` for display and analytics.

### 6.5 Business cascade delete

- When a **Business** is deleted, **SupplierGood** is among the collections deleted by `businessId` in the same transaction (see `app/api/v1/business/[businessId]/route.ts`). So supplier goods are always scoped by and removed with their business.

---

## 7. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate supplierGoodId, supplierId, businessId. |
| `@/lib/cloudinary/uploadFilesCloudinary` | Upload images to `/business/:businessId/suppliersGoods/:supplierGoodId`. |
| `@/lib/cloudinary/deleteFolderCloudinary` | Remove good’s image folder on DELETE. |
| `../inventories/utils/addSupplierGoodToInventory` | Add a new good to open inventory (create/PATCH). |
| `../inventories/utils/deleteSupplierGoodFromInventory` | Remove good from open inventory (DELETE). |
| `@/lib/db/models/supplierGood` | SupplierGood model. |
| `@/lib/db/models/supplier` | Populate supplier tradeName. |
| `@/lib/db/models/inventory` | Used inside inventory utils. |
| `@/lib/db/models/businessGood` | Check ingredient usage before DELETE. |
| `@/lib/interface/ISupplierGood` | Type for create/update payloads. |
| `@/lib/enums` | mainCategoriesEnums, allergensEnums, budgetImpactEnums, inventoryScheduleEnums, purchaseUnitEnums, measurementUnitEnums. |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `supplierGoodId`, `supplierId`, `businessId` before queries or updates.
3. **Use FormData** for POST and PATCH (name, keyword, mainCategory, optional fields, optional files). Parse strings and numbers (e.g. `currentlyInUse === "true"`, `Number(formData.get("parLevel"))`).
4. **Enums:** Validate `mainCategory`, `allergens[]`, `budgetImpact`, `inventorySchedule`, `purchaseUnit`, `measurementUnit` against `lib/enums`.
5. **Uniqueness:** Enforce unique (businessId, supplierId, name) on create and on PATCH (excluding current document).
6. **Images:** Max 3 per good; upload to `/business/:businessId/suppliersGoods/:supplierGoodId`; on DELETE remove folder. Keep transaction and Cloudinary in sync (abort transaction if upload or delete folder fails when intended to be part of the same logical operation).
7. **Inventory sync:** When creating a good (or setting `currentlyInUse` to true on PATCH), add it to the current open inventory in the **same transaction**. When deleting a good, remove it from inventory in the same transaction, then delete Cloudinary folder.
8. **Guard DELETE:** Do not delete if any BusinessGood uses this supplier good as an ingredient; return 409 with a clear message.
9. **Price:** Compute `pricePerMeasurementUnit` when both `totalPurchasePrice` and `quantityInMeasurementUnit` are provided (create and update).

---

## 9. Data model summary (for context)

- **SupplierGood:** Required: `name`, `keyword`, `mainCategory`, `supplierId`, `businessId`. Optional: `currentlyInUse` (default true), `subCategory`, `description`, `allergens[]`, `budgetImpact`, `imagesUrl[]`, `inventorySchedule`, `minimumQuantityRequired`, `parLevel`, `purchaseUnit`, `measurementUnit`, `quantityInMeasurementUnit`, `totalPurchasePrice`, `pricePerMeasurementUnit` (often computed).
- **Uniqueness:** (businessId, supplierId, name) unique.
- **Indexes:** `supplierId`, `businessId` for performance.

This README is the main context for how the supplier goods API works, how it fits into the app (suppliers, inventory, business goods, purchases), and how to extend or integrate with it consistently.
