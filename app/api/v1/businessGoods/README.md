# Business Goods API — `app/api/v1/businessGoods`

This folder contains the **REST API for the BusinessGood entity**: the items a **Business** sells to customers (menu items like burgers, drinks, sides) and the internal **composition logic** that connects those menu items to **SupplierGoods** (ingredients) for **costing**, **allergen aggregation**, and **inventory consumption**.

Business goods are where the app “joins”:

- **Supplier goods** (what you buy from suppliers) → as **ingredients**
- **Inventory** (what you have in stock) → consumed when orders are created
- **Orders** (what customers buy) → reference `businessGoodId` (main product) and optional `addOns`
- **Promotions** (discount rules) → apply to business goods

This document describes how these routes and utilities work, how they interact with the rest of the app, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **BusinessGood** = a sellable item on the POS menu, scoped by `businessId`.
- A business good can be one of:
  - **Ingredient-based:** `ingredients[]` (each ingredient references a `SupplierGood` and the required quantity/unit)
  - **Set menu / combo:** `setMenuIds[]` (references other **BusinessGoods** grouped together)
  - Or **neither** (simple item with no cost/inventory linkage)
- **Cost + allergens are derived:** When you create or update a business good with ingredients or set-menu composition, the API calculates:
  - `costPrice` (sum of ingredient costs or sum of set-menu members’ costPrice)
  - `allergens` (union of ingredient allergens + any manual allergens passed)
- **Gross margin helper:** If `grossProfitMarginDesired` is provided (and a `costPrice` exists), the API computes `suggestedSellingPrice`.
- **Inventory coupling happens via orders:** Orders store `businessGoodId` and optional `addOns`. When orders are created, the system builds a flattened list of those business good IDs (main + addOns per order) and passes it to **updateDynamicCountSupplierGood** to decrement inventory dynamic counts (see `app/api/v1/orders/utils/createOrders.ts` → `app/api/v1/inventories/utils/updateDynamicCountSupplierGood.ts`).

So: **Business goods are the menu layer, but they’re also the “recipe” layer that powers costing, allergens, promotions applicability, and inventory consumption.**

---

## 2. File structure

```
app/api/v1/businessGoods/
├── README.md                                      # This file — context for flow, patterns, and app integration
├── route.ts                                       # GET all business goods | POST create business good
├── business/
│   └── [businessId]/
│       └── route.ts                               # GET business goods by businessId
├── [businessGoodId]/
│   └── route.ts                                   # GET | PATCH | DELETE by businessGoodId
└── utils/
    ├── calculateIngredientsCostPriceAndAllergies.ts # Costs+allergens from supplier-goods ingredients (unit conversion)
    └── calculateSetMenuCostPriceAndAllergies.ts     # Costs+allergens aggregated from set-menu member goods
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/businessGoods` | Returns all business goods (all businesses). Populates ingredient supplier goods and set-menu ids. 404 if none. |
| POST | `/api/v1/businessGoods` | Creates a new business good. Body: **FormData** (supports images). Validates composition and computes cost/allergens. |
| GET | `/api/v1/businessGoods/business/:businessId` | Returns business goods for a business (scoped by `businessId`). |
| GET | `/api/v1/businessGoods/:businessGoodId` | Returns one business good by ID. |
| PATCH | `/api/v1/businessGoods/:businessGoodId` | Partial update. Body: **FormData** (supports adding images). Recomputes cost/allergens if composition is provided. |
| DELETE | `/api/v1/businessGoods/:businessGoodId` | Deletes a business good only if it’s not used in open orders and not used as a set-menu member. Also pulls the id from promotions and deletes Cloudinary folder. Transactional. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns

### 4.1 GET (list, by id, by business)

- **DB:** `connectDb()` before first DB call.
- **Populate pattern:** Business goods populate:
  - `ingredients.supplierGoodId` (select: `name`, `mainCategory`, `subCategory`)
  - `setMenuIds` (select: `name`, `mainCategory`, `subCategory`, `sellingPrice`)

**Important context:** In the schema, `setMenuIds` references **BusinessGood**. Some route handlers currently populate `setMenuIds` using a different model; treat `setMenuIds` as “array of BusinessGood ids” conceptually.

### 4.2 POST (create) — FormData + composition calculation

POST uses **FormData** (not JSON) because it can include image files.

**Required fields (FormData):**

- `name`, `keyword`, `mainCategory`, `onMenu`, `available`, `sellingPrice`, `businessId`

**Optional fields:**

- `subCategory`, `description`, `deliveryTime`
- `grossProfitMarginDesired`
- `allergens` (JSON string array)
- `ingredients` (JSON string array of ingredient objects)
- `setMenuIds` (JSON string array of businessGood ids)
- `imagesUrl` (files; max 3)

**Composition rule:** you can send **either**:

- `ingredients[]` (ingredient-based good), **or**
- `setMenuIds[]` (set-menu good),

but **not both** in the same request. Both may be omitted.

**Validation:**

- `businessId` is validated via `isObjectIdValid`.
- `mainCategory` must be in `mainCategoriesEnums`.
- each `allergen` must be in `allergensEnums`.
- if ingredients are present, each ingredient’s `measurementUnit` must be in `measurementUnitEnums`.
- duplicate check: `BusinessGood.exists({ businessId, name })`.
- images: max 3.

**Images:** If image files are present, upload to Cloudinary folder:

`/business/:businessId/businessGoods/:businessGoodId`

and store URLs in `imagesUrl`.

**Cost and allergens logic:**

- If `ingredients[]` is provided: call `calculateIngredientsCostPriceAndAllergies(ingredients)` (details in section 5).
  - The returned ingredient costs are stored as `ingredients[].costOfRequiredQuantity`.
  - `costPrice` is the sum of all ingredient costs (rounded to 2 decimals).
  - `allergens` is the union of any provided allergens plus supplier-good allergens from ingredients.
  - `setMenuIds` is cleared/undefined.
- If `setMenuIds[]` is provided: call `calculateSetMenuCostPriceAndAllergies(setMenuIds)` (details in section 5).
  - `costPrice` is the sum of costPrice of the referenced business goods.
  - `allergens` is the union across those goods.
  - `ingredients` is cleared/undefined.

**Suggested selling price:**

If both `costPrice` and `grossProfitMarginDesired` are present:

\[
\text{suggestedSellingPrice} = \text{costPrice} \times \left(1 + \frac{\text{grossProfitMarginDesired}}{100}\right)
\]

### 4.3 PATCH (update by id) — FormData + recomputation

- Same FormData and validation rules as POST.
- Duplicate name protection excludes current doc:
  - `BusinessGood.exists({ _id: { $ne: businessGoodId }, businessId: <existing>, name })`
- Images: total images (existing + new) must not exceed 3; new images are appended.
- If `ingredients` is provided, recompute ingredients cost + allergens and clear setMenuIds.
- If `setMenuIds` is provided, recompute set-menu cost + allergens and clear ingredients.
- If `grossProfitMarginDesired` and `costPrice` exist, recompute `suggestedSellingPrice`.

### 4.4 DELETE (delete by id) — transactional + guarded

DELETE is intentionally restricted for integrity and analytics. This endpoint deletes only when safe:

- **Cannot delete if used in open orders:** checks `Order.exists({ $or: [ { businessGoodId }, { addOns: businessGoodId } ], billingStatus: \"Open\" })` (good cannot be deleted if it is the main product or an add-on of any open order).
- **Cannot delete if it is part of a set menu:** checks `BusinessGood.exists({ setMenuIds: businessGoodId })`.

If deletable, in a MongoDB transaction it:

1. Deletes the business good document.
2. Pulls `businessGoodId` out of promotions: `Promotion.updateMany({ businessGoodsToApplyIds: businessGoodId }, { $pull: ... })`.
3. Deletes the Cloudinary folder `/business/:businessId/businessGoods/:businessGoodId`.

---

## 5. Utilities: composition, cost, allergens

### 5.1 `calculateIngredientsCostPriceAndAllergies`

- **Location:** `utils/calculateIngredientsCostPriceAndAllergies.ts`
- **Input:** `ingredients[]` (objects with required keys: `supplierGoodId`, `measurementUnit`, `requiredQuantity`)
- **What it does:**
  - Validates each ingredient object structure via `objDefaultValidation`.
  - Loads each `SupplierGood` and selects `measurementUnit`, `pricePerMeasurementUnit`, `allergens`.
  - If ingredient’s unit differs from the supplier good’s unit, converts the required quantity with `convert-units`.
  - Computes `costOfRequiredQuantity = pricePerMeasurementUnit * convertedQuantity`.
  - Returns a normalized list including `allergens` from the supplier good.

**Important coupling:** Correct cost calculation depends on `SupplierGood.pricePerMeasurementUnit` and `SupplierGood.measurementUnit` being set. If they’re missing/undefined, the computed costs will be 0.

### 5.2 `calculateSetMenuCostPriceAndAllergies`

- **Location:** `utils/calculateSetMenuCostPriceAndAllergies.ts`
- **Input:** `setMenuIds[]` (array of BusinessGood ids)
- **What it does:**
  - Validates ids with `isObjectIdValid`.
  - Fetches all referenced business goods (`select: costPrice, allergens`).
  - Sums their `costPrice` and unions their `allergens`.

---

## 6. How other parts of the app use Business Goods

### 6.1 Orders (sales flow)

- Orders store `businessGoodId` and optional `addOns`. Callers pass a flattened list (main + addOns per order).
- At order creation time (`app/api/v1/orders/utils/createOrders.ts`), after inserting orders, the API builds that list and calls:
  - `updateDynamicCountSupplierGood(businessGoodsIds, \"remove\", session)`
- That inventory helper expands business goods → ingredients (including set-menu members), converts units where needed, and decrements `inventoryGoods.$.dynamicSystemCount` for each `supplierGoodId`.

This is the core **“sale consumes stock”** mechanism.

### 6.2 Inventory (stock tracking)

Inventory is updated in two major directions:

- **Incoming stock:** Purchases increment inventory for supplier goods bought (see purchases README).
- **Outgoing stock:** Orders decrement inventory via business-good ingredients (this folder’s model drives the mapping).

So business goods are the **translation layer** between “what we sell” and “what stock items are consumed.”

### 6.3 Supplier goods (ingredients and costing)

Business goods depend on supplier goods to provide:

- the **measurement unit** for consistent unit conversion
- the **pricePerMeasurementUnit** for cost computations
- **allergens** for aggregated allergen warnings

### 6.4 Promotions (pricing rules)

Promotions target business goods. Orders store `promotionApplyed` and pricing is expected to be calculated on the front end for real-time UX (see notes in `createOrders.ts`). When a business good is deleted, this API removes it from promotion documents to avoid dangling references.

### 6.5 Printers / routing (operational flow)

Business goods carry `mainCategory` / `subCategory`, which are commonly used across the app for grouping and routing (e.g., kitchens/bars, category-based screens, reports). Keep these consistent with enum expectations.

---

## 7. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before DB calls. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate ids (businessId, businessGoodId, setMenu ids). |
| `@/lib/utils/objDefaultValidation` | Validate ingredient object shape inside cost calculator. |
| `@/lib/cloudinary/uploadFilesCloudinary` | Upload images to `/business/:businessId/businessGoods/:businessGoodId`. |
| `@/lib/cloudinary/deleteFolderCloudinary` | Remove the business-good image folder on DELETE. |
| `@/lib/db/models/businessGood` | BusinessGood model. |
| `@/lib/db/models/supplierGood` | Ingredient reference and populate target; provides costing and allergens. |
| `@/lib/db/models/order` | Prevent deletion while in open orders. |
| `@/lib/db/models/promotion` | Pull deleted business good id from promotions. |
| `@/lib/enums` | `mainCategoriesEnums`, `measurementUnitEnums`, `allergensEnums`. |
| `convert-units` | Unit conversion for ingredient costing and inventory consumption logic. |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before first DB operation in each handler.
2. **Validate IDs early** with `isObjectIdValid` before queries.
3. **Use FormData** on POST/PATCH because images may be included.
4. **Composition is mutually exclusive:** enforce `ingredients XOR setMenuIds` (or neither).
5. **Recompute derived fields** whenever composition changes:
   - ingredients → recompute `ingredients[]`, `costPrice`, allergens union
   - setMenuIds → recompute `costPrice`, allergens union
6. **Keep units consistent:** ingredient measurement units must be convertible; rely on supplier-good units and `convert-units`.
7. **Guard deletions** to protect operational integrity:
   - no delete if referenced by open orders
   - no delete if included in any set menu
   - clean up promotions references
8. **Cloudinary folder conventions:** `/business/:businessId/businessGoods/:businessGoodId` and keep max 3 images.

---

## 9. Data model summary (for context)

- **BusinessGood:** `name`, `keyword`, `mainCategory`, optional `subCategory`, `onMenu`, `available`, `sellingPrice`, `businessId`.
- **Either** `ingredients[]` **or** `setMenuIds[]`:
  - `ingredients[]`: `{ supplierGoodId, measurementUnit, requiredQuantity, costOfRequiredQuantity }`
  - `setMenuIds[]`: array of `BusinessGood` ids
- Derived fields: `costPrice`, `grossProfitMarginDesired`, `suggestedSellingPrice`, `allergens`, optional `imagesUrl[]`, optional `deliveryTime`.

This README is the main context for how the business goods API works, and how it ties suppliers → costing/allergens → orders → inventory consumption across the app.

