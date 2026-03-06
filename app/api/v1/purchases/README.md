# Purchases API — `app/api/v1/purchases`

This folder contains the **REST API for the Purchase entity**: records of goods bought from **Suppliers** by a **Business**, typically one purchase per receipt. Purchases are the bridge between **supply** (suppliers, supplier goods) and **inventory**: creating or updating purchase lines updates the business’s **Inventory** (e.g. `dynamicSystemCount`), and deleting a purchase (or removing a line) reverses that stock change.

This document describes how the purchase routes work, how they interact with suppliers, inventory, and the “One Time Purchase” flow, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **Purchase** = one receipt/transaction: a business buys a set of **supplier goods** from a **supplier** on a given date, recorded by an **employee**, with a unique **receiptId** per (business, supplier, receipt).
- **One purchase, many lines:** A single purchase can have multiple **purchaseInventoryItems** (each: `supplierGoodId`, `quantityPurchased`, `purchasePrice`). Quantities are expressed in the **supplier good’s measurement unit**, not the purchase unit.
- **Inventory coupling:** When a purchase is **created**, each line increases the matching inventory good’s `dynamicSystemCount` by `quantityPurchased`. When a purchase is **deleted**, each line decreases it. **Add** / **edit** / **delete** line routes keep purchase and inventory in sync inside a transaction.
- **One Time Purchase:** The API supports `supplierId === "One Time Purchase"`. In that case the route resolves or creates a special supplier via `oneTimePurchaseSupplier(businessId)` and does **not** update inventory (no real supplier goods to track). This is for rare/emergency buys; the preferred flow is to create a real supplier and goods first.

So: **Purchases are the source of “incoming stock” for the business; they tie suppliers to inventory and to the employee who recorded the receipt.**

---

## 2. File structure

```
app/api/v1/purchases/
├── README.md                                    # This file — context for flow, patterns, and app integration
├── route.ts                                     # GET all purchases (optional date range) | POST create purchase
├── [purchaseId]/
│   └── route.ts                                 # GET | PATCH | DELETE by purchaseId
│   ├── addSupplierGoodToPurchase/
│   │   └── route.ts                             # PATCH — add one line to purchase + update inventory
│   ├── deleteSupplierGoodFromPurchase/
│   │   └── route.ts                             # PATCH — remove one line by subdocument id + adjust inventory
│   └── editSupplierGoodFromPurchase/
│       └── route.ts                             # PATCH — edit one line (qty/price) + adjust inventory
├── supplier/
│   └── [supplierId]/
│       └── route.ts                             # GET purchases for a supplier (optional date range)
├── user/
│   └── [userId]/
│       └── route.ts                             # GET purchases by employee (optional date range)
└── utils/
    └── validateInventoryPurchaseItems.ts       # Validates purchaseInventoryItems array shape and values
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/purchases?startDate=&endDate=` | Returns all purchases (optional date filter). Populates supplier + items. 404 if none. |
| POST | `/api/v1/purchases` | Creates a new purchase and updates inventory for each line. Body: **JSON**. Supports "One Time Purchase". Transactional. |
| GET | `/api/v1/purchases/:purchaseId` | Returns one purchase by ID. 404 if not found. |
| PATCH | `/api/v1/purchases/:purchaseId` | Updates purchase header only (title, date, employee, receiptId). Does **not** change lines. |
| DELETE | `/api/v1/purchases/:purchaseId` | Deletes purchase and **decrements** inventory for each line. Transactional. |
| PATCH | `/api/v1/purchases/:purchaseId/addSupplierGoodToPurchase` | Appends one item to `purchaseInventoryItems` and **increments** inventory. Transactional. |
| PATCH | `/api/v1/purchases/:purchaseId/deleteSupplierGoodFromPurchase` | Removes one item by `purchaseInventoryItemsId` and **decrements** inventory. Transactional. |
| PATCH | `/api/v1/purchases/:purchaseId/editSupplierGoodFromPurchase` | Updates one item’s quantity/price and **adjusts** inventory delta. Transactional. |
| GET | `/api/v1/purchases/supplier/:supplierId?startDate=&endDate=` | Returns purchases for a supplier. Optional date range. |
| GET | `/api/v1/purchases/user/:userId?startDate=&endDate=` | Returns purchases made by an employee. Optional date range. |

All responses are JSON (except one DELETE returns plain text). Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404.

---

## 4. Request/response patterns and validation

### 4.1 GET (list, by ID, by supplier, by user)

- **DB:** `connectDb()` before first query.
- **Optional date range:** Query params `startDate` and `endDate` (e.g. `"2023-04-01T00:00:00"`). If both present, must satisfy `startDate <= endDate`; then filter by `purchaseDate` in range.
- **Populates:** `supplierId` (tradeName), `purchaseInventoryItems.supplierGoodId` (name, mainCategory, subCategory, measurementUnit, pricePerMeasurementUnit).

### 4.2 POST (create purchase) — JSON body + transaction

**Required fields:**

- `supplierId` (ObjectId or the string `"One Time Purchase"`)
- `purchaseDate`
- `businessId`
- `purchasedByEmployeeId`
- `purchaseInventoryItems` (array of `{ supplierGoodId, quantityPurchased, purchasePrice }`)
- `receiptId`

**Optional:** `title`, `comment`. If `supplierId === "One Time Purchase"`, `comment` is **required**.

**Validation:**

- `businessId` and `purchasedByEmployeeId` validated with `isObjectIdValid` (supplierId is not validated when it is `"One Time Purchase"`).
- `validateInventoryPurchaseItems(purchaseInventoryItems, isOneTimePurchase)` ensures array non-empty, each item has valid `supplierGoodId` (unless one-time), positive `quantityPurchased` and `purchasePrice`.

**One Time Purchase flow:**

- If `supplierId === "One Time Purchase"`: call `oneTimePurchaseSupplier(businessId)` to get or create the special supplier; replace `supplierId` with that ObjectId and set each item’s `supplierGoodId` to it (placeholder). One-time purchases **do not** update inventory (no real supplier goods).

**Normal flow:**

- Check duplicate `(businessId, supplierId, receiptId)`.
- Create purchase with `totalAmount` = sum of `purchasePrice` per line.
- In the **same transaction**, run a bulk update on **Inventory**: for each purchase line, find the inventory document for that business with `setFinalCount: false` and a matching `inventoryGoods.supplierGoodId`, and `$inc` `inventoryGoods.$.dynamicSystemCount` by `quantityPurchased`.
- Commit.

### 4.3 PATCH (update purchase header only)

- Updates only: `title`, `purchaseDate`, `purchasedByEmployeeId`, `receiptId`.
- Does **not** modify `purchaseInventoryItems`; use add/delete/edit line routes for that.
- Duplicate check: if `receiptId` is sent, it must not already exist for another purchase of the same business (current implementation uses `id: { $ne: purchaseId }` in one place; should be `_id` for MongoDB).

### 4.4 DELETE (delete purchase and reverse inventory)

- In a transaction: delete the purchase document, then for each `purchaseInventoryItems` line run an inventory update that **decrements** `inventoryGoods.$.dynamicSystemCount` by `quantityPurchased`.
- Ensures stock is consistent when a receipt is voided or removed.

### 4.5 Add / delete / edit line routes

- **Add:** Body `supplierGoodId`, `quantityPurchased`, `purchasePrice`. Push one element into `purchaseInventoryItems`, `$inc totalAmount`, and increment inventory for that supplier good. All in one transaction.
- **Delete:** Body `purchaseInventoryItemsId` (subdocument `_id`). Pull that element, adjust `totalAmount`, and decrement inventory. Transaction.
- **Edit:** Body `purchaseInventoryItemsId`, `newQuantityPurchased`, `newPurchasePrice`. Set the line’s quantity and price, adjust `totalAmount` by the price delta, and update inventory by the quantity delta. Transaction.

**Important:** Inventory updates filter by `businessId`, `setFinalCount: false`, and the matching `inventoryGoods.supplierGoodId`. The inventory model must have an open (non-final) inventory for that business and that supplier good for the update to succeed.

---

## 5. Validation helper: `validateInventoryPurchaseItems`

- **Location:** `utils/validateInventoryPurchaseItems.ts`.
- **Purpose:** Ensures `purchaseInventoryItems` is a non-empty array; each item has valid `supplierGoodId` (when not one-time purchase), positive `quantityPurchased` and `purchasePrice`.
- **Used by:** POST `/purchases` only. Add/edit line routes do not use it; they rely on the caller sending valid values.

---

## 6. How other parts of the app use Purchases

### 6.1 Suppliers and supplier goods

- Every purchase has a `supplierId`. Normal purchases reference a real **Supplier**; lines reference **SupplierGood** ids. One Time Purchase uses a synthetic supplier and does not create or update supplier goods.
- **Suppliers README** describes `oneTimePurchaseSupplier` and the reserved "One Time Purchase" string.

### 6.2 Inventory

- **Inventory** holds per–supplier-good counts per business (e.g. `inventoryGoods[].dynamicSystemCount`). Purchases **increase** these counts on create/add line; they **decrease** on delete or delete-line. Edit line applies the **delta** in quantity.
- Inventory is typically monthly and has `setFinalCount`; purchase updates target the current open inventory (`setFinalCount: false`).

### 6.3 Business and employees

- Purchases are scoped by `businessId` and record `purchasedByEmployeeId`. GET by `user` (employee) supports “purchases made by this employee” for auditing or reporting.
- When the **Business** is deleted, all its **Purchase** documents are removed in the business cascade (see `app/api/v1/business/[businessId]/route.ts`).

### 6.4 Orders and cost

- Orders consume ingredients (business goods → supplier goods). That consumption **decrements** inventory dynamic count (see orders flow). Purchases are the **incoming** side that restock those same counts.

---

## 7. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate purchaseId, businessId, employeeId, supplierId, supplierGoodId, purchaseInventoryItemsId. |
| `../suppliers/utils/oneTimePurchaseSupplier` | Resolve or create "One Time Purchase" supplier for a business. |
| `./utils/validateInventoryPurchaseItems` | Validate `purchaseInventoryItems` array for POST. |
| `@/lib/db/models/purchase` | Purchase model. |
| `@/lib/db/models/inventory` | Update `inventoryGoods.$.dynamicSystemCount`. |
| `@/lib/db/models/supplier`, `SupplierGood` | Populate supplier and line items. |
| `@/lib/interface/IPurchase`, `IPurchaseItem` | Types for purchase and line items. |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before DB work.
2. **Validate IDs** with `isObjectIdValid` (purchaseId, businessId, employeeId, supplierGoodId, subdocument ids). Do not validate `supplierId` when it is the string `"One Time Purchase"`.
3. **Keep purchase and inventory in sync** inside a **single transaction** when creating, deleting, or changing purchase lines.
4. **One purchase = one receipt:** Enforce uniqueness of `(businessId, supplierId, receiptId)` on create (and on header update if receiptId can change).
5. **Quantities in measurement unit:** `quantityPurchased` is in the supplier good’s **measurement unit**; purchase price is total for that quantity (often `pricePerMeasurementUnit * quantityPurchased` from the front end).
6. **One Time Purchase:** Do not update inventory; require a comment. Prefer creating real suppliers and goods when possible.
7. **Return consistent JSON** (and document any plain-text response like one DELETE).

---

## 9. Data model summary (for context)

- **Purchase:** `supplierId`, `purchaseDate`, `businessId`, `purchasedByEmployeeId`, `totalAmount`, `receiptId`, optional `title`, `documentsUrl`, `purchaseInventoryItems[]`, `oneTimePurchase`, optional `comment`.
- **Purchase item (subdocument):** `supplierGoodId`, `quantityPurchased`, `purchasePrice`.

This README is the main context for how the purchases API works, how it fits into the app (suppliers, inventory, business, employees), and how to extend it consistently.
