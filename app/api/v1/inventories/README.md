# Inventories API — `app/api/v1/inventories`

This folder contains the **REST API and shared logic for the Inventory entity**: monthly, business-scoped stock tracking of **SupplierGoods**. Inventory is the layer that holds **dynamic system counts** (consumed by orders, replenished by purchases) and **physical count snapshots** (monthly counts, deviation, re-edits). The files here are central to the **supply side** of the app: they tie **suppliers**, **supplier goods**, **purchases**, and **orders** (via business-good ingredients) into a single view of what the business has in stock.

This document describes how the routes and utils work, how they follow and interact with other parts of the app (orders, purchases, supplier goods, business), the patterns and logic behind them, and why they matter for the system as a whole.

---

## 1. Purpose and role in the application

- **Inventory** = one **monthly** record per business. Each inventory has `inventoryGoods[]`: one entry per **SupplierGood** that the business has in use. Each entry has:
  - **dynamicSystemCount**: running quantity in the supplier good’s **measurement unit** — automatically decreased when **orders** consume ingredients and increased when **purchases** are recorded.
  - **monthlyCounts[]**: physical count events (who counted, when, quantity, deviation from system count, re-edits).
- **Supplier relationship:** Inventory does not reference **Supplier** directly; it references **SupplierGood**. SupplierGoods are the catalog of products the business buys (from one or more suppliers). So inventory is “per supplier good, per business, per month”; the supplier appears only when populating `supplierGoodId` for display (e.g. supplier trade name).
- **Single source of stock:** All “how much do we have?” answers for tracked goods come from the **current open inventory** (`setFinalCount: false`) for that business. Orders and purchases read/update this same layer.
- **Lifecycle:** On the **first day of the month** (or when the system triggers it), a new inventory is created with all **currently in use** supplier goods; the previous month’s inventory is marked **setFinalCount: true** (closed). Only the open inventory receives order/purchase updates and new physical counts.

So: **Inventories are the single place where supplier-good stock levels live; they are driven by orders (consumption) and purchases (replenishment), and refined by physical counts and re-edits.**

---

## 2. File structure

```
app/api/v1/inventories/
├── README.md                    # This file — context for flow, patterns, and app integration
├── route.ts                     # GET all inventories | POST create inventory (first day of month)
├── business/
│   └── [businessId]/
│       ├── route.ts             # GET inventories by businessId (optional ?monthDate)
│       ├── lowStock/
│       │   └── route.ts         # GET — items below par/minimum for dashboard
│       └── varianceReport/
│           └── route.ts        # GET — theoretical vs actual usage per supplier good (?month=YYYY-MM)
├── [inventoryId]/
│   ├── route.ts                 # GET one inventory | DELETE one (rare; see section 6)
│   ├── close/
│   │   └── route.ts             # PATCH — manager-only close + auto-create next period inventory
│   └── supplierGood/
│       └── [supplierGoodId]/
│           ├── route.ts         # GET inventory entries for one supplier good (optional ?monthDate)
│           ├── addCountToSupplierGood/
│           │   └── route.ts     # PATCH — add a new physical count for this supplier good
│           └── updateCountFromSupplierGood/
│               └── route.ts     # PATCH — re-edit last count (manager/supervisor on duty; countedByEmployeeId + reason required)
└── utils/
    ├── updateDynamicCountSupplierGood.ts   # Used by orders: add/remove quantity from dynamicSystemCount
    ├── addSupplierGoodToInventory.ts       # Used by supplier goods: add good to open inventory
    ├── deleteSupplierGoodFromInventory.ts  # Used by supplier goods: remove good from open inventory
    ├── createNextPeriodInventory.ts         # Used by close: create next month inventory in same transaction
    ├── checkLowStockAndNotify.ts           # Fire-and-forget: low-stock Warning notification to managers on duty
    ├── getTheoreticalUsage.ts              # Usage from orders (ingredients) in date range
    ├── getActualUsage.ts                   # Opening + purchases - closing in date range
    └── getVarianceReport.ts                # Variance report (theoretical vs actual) per supplier good
```

- **`route.ts`** (root): list all inventories; POST creates a new monthly inventory (closes previous, creates new with all `currentlyInUse` supplier goods). **Preferred flow for bootstrap;** for month-end close use **PATCH close**.
- **`business/[businessId]/route.ts`**: list inventories for a business, optionally filtered by `?monthDate`.
- **`business/[businessId]/lowStock/route.ts`**: GET items below par or minimum for the open inventory (dashboard/alerts).
- **`business/[businessId]/varianceReport/route.ts`**: GET theoretical vs actual usage per supplier good for a month (`?month=YYYY-MM`; default current month).
- **`[inventoryId]/route.ts`**: get one inventory by ID; DELETE exists but is discouraged for data integrity (see section 6).
- **`[inventoryId]/close/route.ts`**: **Manager-only** (General Manager, Manager, Assistant Manager, MoD, Admin). PATCH with auth from **session** (userId → Employee.findOne({ userId, businessId }) for role and onDuty). Closes current inventory (`setFinalCount: true`) and **auto-creates next period inventory** in the same transaction (via `createNextPeriodInventory`).
- **`[inventoryId]/supplierGood/[supplierGoodId]/route.ts`**: get inventory data for a specific supplier good (optional `?monthDate`).
- **`addCountToSupplierGood`**: add a new physical count (current quantity, deviation, par level, comments); updates `dynamicSystemCount` and `monthlyCounts`.
- **`updateCountFromSupplierGood`**: re-edit the **last** count. **Requires** `countId`, `reason`, and **`countedByEmployeeId`**. Only **managers or supervisors on duty** (General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor) may re-edit; 403 otherwise.
- **Utils** are used by **orders** (`updateDynamicCountSupplierGood`, `checkLowStockAndNotify` after commit), **supplier goods** (`addSupplierGoodToInventory`, `deleteSupplierGoodFromInventory`), and **close** (`createNextPeriodInventory`). Variance utils power the variance report route.

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/inventories` | Returns all inventories (populated supplierGoodId, supplier tradeName). 404 if none. |
| POST | `/api/v1/inventories` | Creates a new monthly inventory for `businessId` (body: `{ businessId }`). Closes previous month; 400 if current month already exists. **Intended to run on first day of month.** |
| GET | `/api/v1/inventories/business/:businessId` | Returns inventories for business. Optional `?monthDate=<date>` to filter by month. 404 if none. |
| GET | `/api/v1/inventories/:inventoryId` | Returns one inventory by ID (populated). 404 if not found. |
| DELETE | `/api/v1/inventories/:inventoryId` | Deletes one inventory. **Discouraged** except for cleanup; see section 6. |
| GET | `/api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId` | Returns inventory entries for that supplier good. Optional `?monthDate`. 404 if none. |
| PATCH | `/api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/addCountToSupplierGood` | Adds a new physical count. Body: `currentCountQuantity`, optional `countedByEmployeeId`, `comments`. Updates `dynamicSystemCount` and appends to `monthlyCounts`. 400 if inventory already finalized. |
| PATCH | `/api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/updateCountFromSupplierGood` | Re-edit the **last** count. Body: **`countId`, `reason`, `countedByEmployeeId`** (required), `currentCountQuantity`, optional `comments`. **Manager or supervisor on duty** only; 403 otherwise. 400 if finalized; 404 if count not found. |
| PATCH | `/api/v1/inventories/:inventoryId/close` | **Manager-only.** Auth from session (userId → Employee for role/onDuty). Closes inventory and auto-creates next period inventory in one transaction. 403 if not allowed role or not on duty. |
| GET | `/api/v1/inventories/business/:businessId/lowStock` | Returns items below par or minimum for the open inventory. Response: `{ lowStock: [...] }` with supplierGoodId, supplierGood, dynamicSystemCount, parLevel, minimumQuantityRequired, measurementUnit. |
| GET | `/api/v1/inventories/business/:businessId/varianceReport?month=YYYY-MM` | Returns theoretical vs actual usage per supplier good for the month. Default month = current. Response: `{ varianceReport: [...] }` with supplierGoodId, supplierGoodName, theoreticalQuantity, actualQuantity, varianceQuantity, measurementUnit. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/403/404.

---

## 4. Request/response patterns

### 4.1 GET (list and by ID / by business / by supplier good)

- **DB**: `connectDb()` before first query. Queries use `Inventory.find()` or `findById()` with `.populate("inventoryGoods.supplierGoodId", ...)` and nested populate of `supplierId` (tradeName) from **Supplier**.
- **Validation**: For routes with dynamic segments, `inventoryId`, `businessId`, `supplierGoodId` are validated with `isObjectIdValid(...)`.
- **Optional query:** `monthDate` (e.g. `?monthDate=2023-04-01T15:00:00`) is parsed to the first and last day of that month; `createdAt` is filtered `$gte` / `$lte` for that range.
- **Response**: 200 + JSON (array or single object); 404 with `{ message: "..." }` when no data or invalid ID.

### 4.2 POST (create monthly inventory)

- **Body:** JSON `{ businessId }`.
- **Validation:** `isObjectIdValid([businessId])`. Returns 400 if invalid.
- **Logic:** Run in a **MongoDB transaction**:
  1. If an inventory already exists for the **current month** (by `createdAt`), return 400.
  2. Find the **previous month’s** inventory for that business and set `setFinalCount: true`.
  3. Load all **SupplierGood** for that `businessId` with `currentlyInUse: true`.
  4. Build `inventoryGoods[]`: for each supplier good, set `dynamicSystemCount` from the previous inventory’s last count (if any), or 0; `monthlyCounts: []`.
  5. Create the new **Inventory** document with `setFinalCount: false`.
- **Response:** 201 + success message; 400 if current month exists or invalid ID; 500 on transaction error.

### 4.3 PATCH addCountToSupplierGood

- **Body:** `currentCountQuantity` (required), optional `countedByEmployeeId`, `comments`.
- **Validation:** `inventoryId`, `supplierGoodId`, `countedByEmployeeId` validated with `isObjectIdValid`. Inventory must exist and contain that `supplierGoodId`; `setFinalCount` must be false.
- **Logic:** Load inventory (matching element via `inventoryGoods.supplierGoodId`) and SupplierGood (for `parLevel`). Compute `deviationPercent` from `dynamicSystemCount` vs `currentCountQuantity`, and `quantityNeeded` from par level. Set previous `monthlyCounts[].lastCount` to false; push new count with `lastCount: true`; set `dynamicSystemCount` to `currentCountQuantity`; recalculate `averageDeviationPercent`.
- **Response:** 200 success; 400 if finalized or count unchanged; 404 if inventory/supplier good not found.

### 4.4 PATCH updateCountFromSupplierGood

- **Body:** `countId`, `reason`, **`countedByEmployeeId`** (all required for re-edit), `currentCountQuantity`, optional `comments`.
- **Validation:** Same ID checks; **countedByEmployeeId** must be a valid employee with **currentShiftRole** in (General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor) and **onDuty: true**; otherwise 403. Inventory must not be finalized; the count with `_id === countId` must exist in that supplier good’s `monthlyCounts`.
- **Logic:** Recompute deviation from the “previous” dynamic count (derived from the count being edited). Update that count document with new quantity, deviation, and `reedited: { reeditedByEmployeeId, date, reason, originalValues }`. Update `dynamicSystemCount` and `averageDeviationPercent`.
- **Response:** 200 success; 400 if finalized or same quantity; 403 if not manager/supervisor on duty; 404 if count not found.

---

## 5. Utils (used by other domains)

These functions live under `app/api/v1/inventories/utils/` and are **not** HTTP endpoints. They are used by **orders** and **supplier goods** to keep inventory in sync.

### 5.1 updateDynamicCountSupplierGood

- **Signature:** `updateDynamicCountSupplierGood(businessGoodsIds, addOrRemove, session)` where `addOrRemove` is `"add"` or `"remove"`, and `session` is a MongoDB `ClientSession`.
- **Purpose:** When **orders** are created, ingredients (supplier goods) are **consumed** → decrease `dynamicSystemCount`. When orders are **cancelled**, stock is **restored** → increase `dynamicSystemCount`.
- **Logic:**
  1. Load **BusinessGood** for the given IDs with `ingredients` (supplierGoodId, measurementUnit, requiredQuantity) and `setMenuIds` (populated with their ingredients).
  2. Flatten all ingredients from business goods and set menus into a list of `{ ingredientId, requiredQuantity, measurementUnit }`.
  3. Use **Inventory** aggregation: match inventory with `setFinalCount: false` and `inventoryGoods.supplierGoodId` in that list; filter inventoryGoods to those IDs; lookup **SupplierGood** for measurement units.
  4. For each ingredient, convert quantity to the supplier good’s unit if needed (`convert-units`), then **bulkWrite** `updateOne`: filter by `inventoryGoods.supplierGoodId`, `$inc` `inventoryGoods.$.dynamicSystemCount` by +quantity (“add”) or -quantity (“remove”).
- **Callers:** `app/api/v1/orders/utils/createOrders.ts` (after creating orders) with `"remove"`; `app/api/v1/orders/utils/cancelOrders.ts` with `"add"`. Both pass the request’s transaction `session` so inventory and orders stay consistent.
- **Important:** Only the **open** inventory (`setFinalCount: false`) that contains those supplier goods is updated; inventories are business-scoped, so the correct business’s inventory is updated when orders are already scoped by business.

### 5.2 addSupplierGoodToInventory

- **Signature:** `addSupplierGoodToInventory(supplierGoodId, businessId, session)`.
- **Purpose:** When a **SupplierGood** is created (or toggled to “in use”), add it to the current month’s open inventory so it can receive purchases and order consumption.
- **Logic:** `Inventory.findOneAndUpdate({ businessId, setFinalCount: false }, { $push: { inventoryGoods: { supplierGoodId, monthlyCounts: [], dynamicSystemCount: 0 } } }, { session })`. Returns error string if no open inventory found.
- **Callers:** `app/api/v1/supplierGoods/route.ts` (POST create) and `app/api/v1/supplierGoods/[supplierGoodId]/route.ts` (PATCH when setting `currentlyInUse: true` and good not yet in inventory). Both run inside a transaction.

### 5.3 deleteSupplierGoodFromInventory

- **Signature:** `deleteSupplierGoodFromInventory(supplierGoodId, businessId, session)`.
- **Purpose:** When a **SupplierGood** is deleted, remove it from the open inventory’s `inventoryGoods` array.
- **Logic:** `Inventory.findOneAndUpdate({ businessId, setFinalCount: false }, { $pull: { inventoryGoods: { supplierGoodId } } }, { session })`. Returns error string if no open inventory found.
- **Caller:** `app/api/v1/supplierGoods/[supplierGoodId]/route.ts` (DELETE), inside the same transaction as the supplier good deletion.

---

## 6. DELETE inventory and data integrity

- **DELETE** `/api/v1/inventories/:inventoryId` exists but is **intentionally discouraged** for normal operation. Inventories are kept for **historical and analytics**; the only intended bulk removal is when the **Business** is deleted (cascade in `app/api/v1/business/[businessId]/route.ts`).
- If you need to remove an inventory (e.g. data correction), use DELETE with care; ensure no reporting or reconciliation logic depends on that document.

---

## 7. How inventories interact with the rest of the app

### 7.1 Orders (consumption)

- **Orders** store `businessGoodId` (main product) and optional `addOns`. Callers (createOrders, cancelOrders) build a flattened list `[businessGoodId, ...addOns]` per order and pass it to the util. Each business good has **ingredients** (SupplierGood + quantity + unit) and optionally **setMenuIds** (more business goods with ingredients).
- When orders are **created**, `createOrders` calls **updateDynamicCountSupplierGood(businessGoodsIds, "remove", session)** so the open inventory’s `dynamicSystemCount` **decreases** for each ingredient.
- When orders are **cancelled**, `cancelOrders` calls **updateDynamicCountSupplierGood(businessGoodsIds, "add", session)** to **restore** stock. **getTheoreticalUsage** selects `businessGoodId` and `addOns` from orders and flattens them the same way.
- So: **order created → consume stock; order cancelled → give it back.** No direct reference from Order to Inventory; the link is Order → BusinessGood → ingredients (SupplierGood) → Inventory.inventoryGoods.

### 7.2 Purchases (replenishment)

- **Purchases** are receipts: `purchaseInventoryItems[]` with `supplierGoodId`, `quantityPurchased`, `purchasePrice`. Quantities are in the **supplier good’s measurement unit**.
- On **create purchase**, **add line**, or **edit line**, the purchase routes update **Inventory** directly (not via inventories utils): they run `Inventory.findOneAndUpdate` or `bulkWrite` with filter `businessId`, `setFinalCount: false`, and `inventoryGoods.supplierGoodId`, and `$inc` `inventoryGoods.$.dynamicSystemCount` by the (delta of) quantity.
- So: **purchases add stock**; **orders remove stock**. Both operate on the same `dynamicSystemCount` in the open inventory.

### 7.3 Supplier goods (catalog and in-use set)

- **SupplierGoods** are the catalog of products the business buys. They have `currentlyInUse`.
- When a supplier good is **created** with `currentlyInUse: true` (default), or **PATCH** sets it to true and the good is not yet in the open inventory, the supplier-good routes call **addSupplierGoodToInventory(supplierGoodId, businessId, session)** so the current month’s inventory has an entry for that good (dynamicSystemCount 0, monthlyCounts []).
- When a supplier good is **deleted**, the route calls **deleteSupplierGoodFromInventory(supplierGoodId, businessId, session)** so it is removed from the open inventory.
- So: **inventory’s list of goods** is kept in sync with “what supplier goods are in use” for that business.

### 7.4 Business (tenant and cascade)

- Every inventory has **businessId**. Only one open inventory per business is expected at a time (current month, `setFinalCount: false`).
- **Business DELETE** cascades to **Inventory** (and all other business-scoped collections) in a single transaction; no separate “delete inventories” step is needed from the client.

### 7.5 Summary flow

- **Suppliers** → supply **SupplierGoods** (per business).
- **SupplierGoods** (in use) → appear in **Inventory** `inventoryGoods` (via add/delete utils).
- **Purchases** → increase **Inventory** `dynamicSystemCount`.
- **Orders** (via business good ingredients) → decrease **Inventory** `dynamicSystemCount` (via **updateDynamicCountSupplierGood**).
- **Physical counts** (addCount / updateCount) → record real quantities, deviation, re-edits; **addCount** also sets `dynamicSystemCount` to the counted value for that good.
- **First day of month** → close previous inventory (`setFinalCount: true`), create new inventory with all currently in-use supplier goods and carry over last count (or 0). This can be done via **POST** (root) or, preferably, **PATCH close** (manager-only), which closes and **auto-creates the next period inventory** in one transaction.

### 7.6 Low-stock notifications and variance report

- **checkLowStockAndNotify(businessId)** runs **after order creation** (and optionally after stock-reducing purchase edits). It finds the open inventory, filters items below par or minimum, finds manager-level employees on duty, and creates one **Warning** notification with a message listing those items; it then pushes that notification to those employees. It is fire-and-forget (no session; does not fail the request).
- **Variance report** uses **getTheoreticalUsage** (orders in month, expanded to ingredients, excluded cancelled) and **getActualUsage** (opening closed inventory + purchases in month − closing closed inventory). **getVarianceReport** returns per–supplier-good theoretical, actual, and variance (theoretical − actual) for analytics.

---

## 8. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response in catch blocks. |
| `@/lib/utils/isObjectIdValid` | Validate inventoryId, businessId, supplierGoodId, countId, etc. |
| `@/lib/interface/IInventory`, `IInventoryCount`, `IInventoryGood` | Types for inventory and count structures. |
| `@/lib/interface/ISupplierGood` | Used when reading parLevel for count logic. |
| `@/lib/db/models/inventory` | Mongoose Inventory model. |
| `@/lib/db/models/supplierGood` | Populate and lookup for units/par level. |
| `@/lib/db/models/supplier` | Populate supplier tradeName for responses. |
| `moment` | Month boundaries for POST create and date filters. |
| `convert-units` | Unit conversion in updateDynamicCountSupplierGood (ingredient unit → supplier good unit). |
| **BusinessGood** (in utils) | Resolve ingredients and set-menu ingredients for order-driven updates. |

---

## 9. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request.
2. **Validate IDs** with `isObjectIdValid` before find/update/delete (inventoryId, businessId, supplierGoodId, countId, countedByEmployeeId).
3. **Do not allow count updates** when `setFinalCount === true`; return 400 with a clear message.
4. **Use the same transaction** when orders or supplier goods change inventory (pass `session` into updateDynamicCountSupplierGood, addSupplierGoodToInventory, deleteSupplierGoodFromInventory).
5. **Quantities and units:** All inventory counts and dynamicSystemCount are in the **SupplierGood’s measurement unit**. When applying order ingredients, convert from the ingredient’s unit to the supplier good’s unit if they differ.
6. **Month boundaries:** Use start/end of month for “current month” and “previous month” (e.g. moment or setDate(1) and last day); keep query params like `monthDate` consistent (first day of month for clarity).
7. **Re-edits:** Only the **last** count (lastCount: true) is updateable via updateCountFromSupplierGood; require **countedByEmployeeId** and allow only **managers or supervisors on duty**; store `reedited` with reason and original values for audit.
8. **Cascade:** Inventory is deleted only as part of business cascade; avoid ad-hoc DELETE inventory in normal flows.
9. **Close:** Prefer **PATCH close** (manager-only) over POST create for month-end: it closes and creates the next period in one transaction. Use same manager roles as daily report close (General Manager, Manager, Assistant Manager, MoD, Admin).

---

## 10. Data model summary (for context)

- **Inventory:** `businessId`, `setFinalCount` (boolean), `inventoryGoods[]`.
- **inventoryGoods[]:** Each element: `supplierGoodId` (ref SupplierGood), `monthlyCounts[]` (count events), `averageDeviationPercent`, `dynamicSystemCount` (number, same unit as SupplierGood).
- **monthlyCounts[]:** Each count: `currentCountQuantity`, `quantityNeeded` (vs par level), `countedByEmployeeId`, `deviationPercent`, `lastCount`, `comments`, optional `reedited` (who, date, reason, originalValues). `countedDate` from schema default.
- **Units:** All quantities in inventory (dynamicSystemCount, currentCountQuantity) use the **SupplierGood’s measurementUnit**. Orders may specify ingredients in different units; conversion is done in updateDynamicCountSupplierGood.

This README is the main context for how the inventories API and utils work, how they fit into the app (suppliers, supplier goods, purchases, orders, business), and how to extend or integrate with them consistently.
