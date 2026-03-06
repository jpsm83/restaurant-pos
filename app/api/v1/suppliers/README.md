# Suppliers API — `app/api/v1/suppliers`

This folder contains the **REST API for the Supplier entity**: vendors or providers that a **Business** buys from. Suppliers are scoped by `businessId`; each business has its own list of suppliers. Supplier **goods** (products offered by a supplier) live in `app/api/v1/supplierGoods` and reference a `supplierId`. Purchases (`app/api/v1/purchases`) reference a supplier and record what was bought. This document describes how the supplier routes work, how they fit into the app, and the patterns to follow when extending or integrating with them.

---

## 1. Purpose and role in the application

- **Supplier** = a vendor the business purchases from (ingredients, beverages, disposables, etc.). It holds company identity (trade name, legal name, email, phone, tax number), address, and a `businessId` so every supplier belongs to one business.
- **Supply chain position:** Suppliers sit between **Business** and **SupplierGood**. The business creates suppliers; then it creates supplier goods (each linked to a supplier). Those goods are used in **BusinessGood** ingredients, **Inventory**, and **Purchase** items. So suppliers are the **source of what the business buys and what goes into menu items and stock**.
- **Uniqueness:** Within a business, `legalName`, `email`, and `taxNumber` must be unique among suppliers (enforced on create and PATCH). The schema also marks `taxNumber` as globally unique.
- **Reserved “One Time Purchase”:** The string `"One Time Purchase"` is reserved. It is used as a **virtual** supplier for emergency or ad-hoc purchases when no registered supplier exists. The purchases route can pass `supplierId === "One Time Purchase"`; the util `oneTimePurchaseSupplier(businessId)` then creates or returns a special supplier record with that trade name so the purchase can be stored. Normal supplier create/update **forbids** using `"One Time Purchase"` for `tradeName`, `legalName`, `phoneNumber`, or `taxNumber`.

So: **Suppliers are the tenant-scoped list of vendors; supplier goods and purchases depend on them.** The routes in this folder are the single source of truth for creating, reading, updating, and (with restrictions) deleting suppliers.

---

## 2. File structure

```
app/api/v1/suppliers/
├── README.md                       # This file — context for flow, patterns, and app integration
├── route.ts                        # GET all suppliers | POST create supplier
├── [supplierId]/
│   └── route.ts                    # GET | PATCH | DELETE by supplierId
├── business/
│   └── [businessId]/
│       └── route.ts                 # GET all suppliers for a business
└── utils/
    └── oneTimePurchaseSupplier.ts  # Create or return the "One Time Purchase" supplier for a business
```

- **`route.ts`** (no dynamic segment): list all suppliers (no filter) and create a new supplier.
- **`[supplierId]/route.ts`**: get one, update, or delete a supplier by ID.
- **`business/[businessId]/route.ts`**: list all suppliers for a given business (main way the UI loads “my suppliers”).
- **`utils/oneTimePurchaseSupplier.ts`**: used by the **purchases** API when recording a “One Time Purchase”; not called from supplier routes directly.

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/suppliers` | Returns all suppliers (no business filter). 404 if none. |
| POST | `/api/v1/suppliers` | Creates a new supplier. Body: **FormData** (see below). |
| GET | `/api/v1/suppliers/:supplierId` | Returns one supplier by ID. 404 if not found. |
| PATCH | `/api/v1/suppliers/:supplierId` | Partial update. Body: **FormData**. |
| DELETE | `/api/v1/suppliers/:supplierId` | Deletes supplier if not in use in any BusinessGood; then deletes Cloudinary folder. 409 if in use. |
| GET | `/api/v1/suppliers/business/:businessId` | Returns all suppliers for the given business. 404 if none. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns

### 4.1 GET (list all, by ID, by business)

- **List all:** `Supplier.find().lean()` — no filter; returns every supplier in the system.
- **By ID:** `supplierId` validated with `isObjectIdValid([supplierId])`, then `Supplier.findById(supplierId).lean()`.
- **By business:** `businessId` validated with `isObjectIdValid([businessId])`, then `Supplier.find({ businessId }).lean()`. This is the **primary way** the app loads suppliers for the current business.
- **Response:** 200 + JSON array or single object; 404 with `{ message: "..." }` when no data or invalid ID.

### 4.2 POST (create) and PATCH (update) — FormData

Both POST and PATCH use **FormData** because the payload can include an image file (`imageUrl`).

**Required fields (POST):**

- `tradeName`, `legalName`, `email`, `phoneNumber`, `taxNumber`, `currentlyInUse` (boolean as string `"true"`/`"false"`), `address` (JSON string), `businessId`.

**Required fields (PATCH):** same as POST except **`businessId` is not in the body** (it is taken from the existing supplier). So: `tradeName`, `legalName`, `email`, `phoneNumber`, `taxNumber`, `currentlyInUse`, `address`.

**Optional (both):**

- `contactPerson`, `imageUrl` (File).

**Address** is a JSON string in FormData. Parsed object must pass `objDefaultValidation(address, reqAddressFields, nonReqAddressFields)`:

- Required: `country`, `state`, `city`, `street`, `buildingNumber`, `postCode`.
- Optional: `region`, `additionalDetails`, `coordinates`.

**Reserved string:** `tradeName`, `legalName`, `phoneNumber`, and `taxNumber` **cannot** be `"One Time Purchase"` when creating or updating a normal supplier (reserved for the one-time-purchase flow).

**Uniqueness (create):** `Supplier.exists({ businessId, $or: [{ legalName }, { email }, { taxNumber }] })`. If a duplicate exists, respond with 409.

**Uniqueness (PATCH):** Same check but with `_id: { $ne: supplierId }` and `businessId` from the existing supplier, so the current document is excluded.

**Email:** Must match a basic email regex (same pattern as in business/address validation).

**Image:** Optional. Uploaded to Cloudinary under `/business/:businessId/suppliers/:supplierId` via `uploadFilesCloudinary` (single file, `onlyImages: true`). On PATCH, upload the new image first, then delete the old one with `deleteFilesCloudinary`. On DELETE supplier, the folder is removed with `deleteFolderCloudinary`.

**Partial update (PATCH):** Only fields that actually changed are set on `updateSupplierObj`; then `Supplier.findByIdAndUpdate(supplierId, { $set: updateSupplierObj }, { new: true, lean: true })`.

---

## 5. One Time Purchase and `oneTimePurchaseSupplier`

**Purpose:** Sometimes the business needs to record a purchase from a vendor that is not (and may never be) a registered supplier — e.g. a one-off buy from a market. The purchases API supports passing `supplierId` as the string `"One Time Purchase"`.

**Flow:**

1. Front-end or API sends a purchase with `supplierId: "One Time Purchase"` (and a required `comment` for context).
2. The purchases route does **not** validate `supplierId` as an ObjectId in that case; it calls `oneTimePurchaseSupplier(businessId)`.
3. **`utils/oneTimePurchaseSupplier.ts`:**  
   - If a supplier already exists for that `businessId` with `tradeName: "One Time Purchase"`, it returns that supplier’s `_id`.  
   - Otherwise it creates a new supplier with:
     - `tradeName`, `legalName`, `phoneNumber`, `taxNumber` = `"One Time Purchase"`.
     - `address` = all required address fields set to `"One Time Purchase"`.
     - `businessId`, `currentlyInUse: true`.
   - Returns the new or existing supplier `_id`.
4. The purchases route then uses this ID as `supplierId` for the purchase document.

**Important:** One-time purchases are **not** intended to update inventory in the same way as normal purchases, because there are no proper **SupplierGood** records to track. The comment in the purchases route states that one-time purchases are for rare cases; the preferred approach is to create a real supplier and supplier goods first, then record the purchase.

**Why the reserved string:** So that normal supplier CRUD never creates or updates a supplier that looks like the system-generated “One Time Purchase” placeholder (avoid clashes and confusion).

---

## 6. DELETE supplier: policy and safeguards

**Design choice:** Deleting a supplier is **intentionally restricted** for data integrity, history, and analytics. The only “full” cleanup of suppliers happens when the **Business** is deleted (business DELETE cascades to `Supplier` and `SupplierGood` in a transaction).

**DELETE route behavior:**

1. Validate `supplierId` with `isObjectIdValid`.
2. **Guard:** Find all `SupplierGood` documents with this `supplierId`. If any of those supplier good IDs are referenced in any **BusinessGood** (in `ingredients.supplierGoodId`), return **409** with message that the supplier is in use in some business goods. No delete is performed.
3. If not in use: `Supplier.findOneAndDelete({ _id: supplierId })`.
4. Delete the Cloudinary folder `/business/:businessId/suppliers/:supplierId` with `deleteFolderCloudinary`.

**No transaction:** Supplier DELETE does not run inside a MongoDB transaction (unlike business DELETE). The order is: delete DB document, then delete Cloudinary folder. If Cloudinary fails, the DB record is already gone; the comment in code notes that supplier delete is only for rare cases when the business is not being deleted.

---

## 7. Shared utilities and dependencies

Used by the supplier routes:

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call (singleton, serverless-safe). |
| `@/lib/db/handleApiError` | Central 500 JSON error response for catch blocks. |
| `@/lib/utils/objDefaultValidation` | Validate address (and other objects) against required/optional key lists. |
| `@/lib/utils/isObjectIdValid` | Validate `supplierId` and `businessId` before queries. |
| `@/lib/cloudinary/uploadFilesCloudinary` | Upload supplier image to `/business/:businessId/suppliers/:supplierId`. |
| `@/lib/cloudinary/deleteFilesCloudinary` | Remove old image on PATCH when replacing. |
| `@/lib/cloudinary/deleteFolderCloudinary` | Remove supplier folder on DELETE. |
| `@/lib/interface/ISupplier` | Type for supplier document. |
| `@/lib/interface/IAddress` | Type for address object. |
| `@/lib/db/models/supplier` | Mongoose model. |

**Referenced in DELETE only:** `SupplierGood` (to get IDs of goods for this supplier), `BusinessGood` (to check if any of those goods are used in ingredients).

**Used by purchases (not by supplier routes):** `oneTimePurchaseSupplier` from `@/app/api/v1/suppliers/utils/oneTimePurchaseSupplier`.

---

## 8. How other parts of the app use Supplier

### 8.1 Business and multi-tenancy

- Every supplier has a required `businessId`. When the **Business** is deleted, all its **Supplier** and **SupplierGood** documents are deleted in the same transaction (see `app/api/v1/business/[businessId]/route.ts` DELETE).
- The main way to load “suppliers for the current business” is **GET** `/api/v1/suppliers/business/:businessId`.

### 8.2 SupplierGoods

- **SupplierGood** has required `supplierId` (ref: Supplier) and `businessId`. Routes: `app/api/v1/supplierGoods/route.ts` (create/list), `app/api/v1/supplierGoods/supplier/[supplierId]/route.ts` (list by supplier), etc.
- Supplier goods define what can be purchased (name, category, measurement unit, price, par level, budget impact, etc.) and are the link between a supplier and inventory / business good ingredients.

### 8.3 Purchases

- **Purchase** has `supplierId` (ref: Supplier). Creating a purchase requires a valid `supplierId` — either a real supplier ObjectId or the special `"One Time Purchase"` string, which triggers `oneTimePurchaseSupplier(businessId)` to resolve to an actual supplier document.
- Purchases record what was bought (receipt), from whom, and for which business; they drive inventory updates (when not one-time) and analytics.

### 8.4 Inventory and BusinessGood

- **Inventory** tracks counts of **SupplierGood** items (via `inventoryGoods.supplierGoodId`). So inventory is tied to supplier goods, which are tied to suppliers.
- **BusinessGood** (menu items / sellable goods) have `ingredients` that reference **SupplierGood** IDs. When checking whether a supplier can be deleted, the code checks if any of its supplier goods are used in any business good’s ingredients.

### 8.5 Flow summary

- **Business** → creates **Suppliers** (and optionally **SupplierGoods**).
- **SupplierGood** → links supplier to a purchasable product; used in **BusinessGood** ingredients and **Inventory**.
- **Purchase** → records a buy from a **Supplier** (or “One Time Purchase”); updates inventory when supplier goods exist.

So: **any feature that deals with “who we buy from” or “what we bought” should go through the supplier and purchase APIs; any feature that uses “what we have in stock” or “what goes into a dish” will indirectly depend on suppliers via SupplierGood.**

---

## 9. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `supplierId` and `businessId` before find/update/delete.
3. **Use FormData** for POST and PATCH (image upload).
4. **Return consistent JSON:** success 200/201 with relevant body; errors 400/404/409/500 with a clear `message` or `especify`/`Error` from `handleApiError`.
5. **Address:** Validate with `objDefaultValidation` and the same required/optional address fields as elsewhere (see Business README).
6. **Reserved string:** Reject `"One Time Purchase"` for `tradeName`, `legalName`, `phoneNumber`, and `taxNumber` in normal supplier create/update.
7. **Uniqueness:** On create and PATCH, enforce unique `legalName`, `email`, and `taxNumber` **per business** (exclude current document on PATCH).
8. **DELETE:** Before deleting a supplier, check that none of its supplier goods are referenced in any BusinessGood’s ingredients; return 409 if in use.
9. **Cloudinary:** Use folder `/business/:businessId/suppliers/:supplierId` for uploads; on supplier DELETE, remove that folder after deleting the document.

---

## 10. Data model summary (for context)

- **Supplier** has: `tradeName`, `legalName`, `email`, `phoneNumber`, `taxNumber` (unique in schema), `businessId` (required, ref: Business), `address` (embedded, same structure as Business address), `currentlyInUse` (boolean), optional `imageUrl`, optional `contactPerson`.
- **Address** follows `IAddress` / `addressSchema` (country, state, city, street, buildingNumber, postCode; optional region, additionalDetails, coordinates).

This README is the main context for how the supplier API works, how it fits into the app (supply chain, purchases, inventory, business goods), and how to extend or integrate with it consistently.
