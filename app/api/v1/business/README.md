# Business API — `app/api/v1/business`

This folder contains the **REST API for the Business entity**: the core tenant of the restaurant POS. Every restaurant/location is a **Business**. All other domain entities (users, employees, orders, suppliers, sales points, etc.) are scoped by `businessId`. This document describes how these routes work, how they fit into the app, and the patterns to follow when extending or integrating with them.

---

## 1. Purpose and role in the application

- **Business** = one restaurant (or location) using the POS. It holds company identity, address, subscription, currency, optional **metrics** (cost percentages, waste thresholds), and optional **discovery/delivery** fields: `cuisineType`, `categories`, `averageRating`, `ratingCount`, `acceptsDelivery`, `deliveryRadius`, `minOrder`.
- **Authentication**: The app uses a **single sign-in form** (email + password). NextAuth validates against **Business** first, then **User** (see `app/api/auth/[...nextauth]/options.ts`). If the email matches a **Business** and the password is correct, the session has type `business` and the user is redirected to the business/admin flow (e.g. `/admin`). Business sessions are the back-office identity.
- **Multi-tenancy**: The app is multi-tenant by `businessId`. The global Zustand store (`app/store/store.ts`) keeps `businessId` (and `username`) after login. API routes under `.../business/[businessId]/...` or that accept `businessId` in the body use it to scope data.
- **Cascade**: Deleting a business (DELETE) removes all related data in a single transaction (employees, orders, suppliers, sales points, etc.) and then the Cloudinary folder for that business.

So: **Business is the root of the data model and the identity used for login.** The routes in this folder are the single source of truth for creating, reading, updating, and deleting that root.

---

## 2. File structure

```
app/api/v1/business/
├── README.md                    # This file — context for flow, patterns, and app integration
├── route.ts                     # GET all businesses | POST create business
├── [businessId]/
│   └── route.ts                 # GET | PATCH | DELETE by businessId
└── utils/
    └── validateBusinessMetrics.ts   # Validation for business metrics (percentages, structure)
```

- **`route.ts`** (no dynamic segment): list and create.
- **`[businessId]/route.ts`**: get one, update, delete by ID.
- **`utils/validateBusinessMetrics.ts`**: shared validation for `metrics` (and nested `supplierGoodWastePercentage`). Can be used by PATCH or any route that accepts metrics.

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/business` | Returns all businesses (password excluded). Optional **query params** for discovery: `cuisineType`, `categories` (comma-separated), `name` or `tradeName` (regex), `rating` or `minRating` (min 0–5), `lat`, `lng`, `radius` (km), `limit` (default 50, max 100). When filters present, results are filtered (and optionally sorted by distance when lat/lng given). 400 if none. |
| POST | `/api/v1/business` | Creates a new business. Body: **FormData** (see below). |
| GET | `/api/v1/business/:businessId` | Returns one business by ID (password excluded). 404 if not found. |
| PATCH | `/api/v1/business/:businessId` | Partial update. Body: **FormData**. |
| DELETE | `/api/v1/business/:businessId` | Deletes business and all related data in a transaction, then Cloudinary folder. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns

### 4.1 GET (list and by ID)

- **List (no query params):** `Business.find().select("-password").lean()`. Returns all businesses; 400 if none.
- **List with discovery filters (query params):** When any of `cuisineType`, `categories`, `name`/`tradeName`, `rating`/`minRating`, or `lat`+`lng` are present, build a filter: `cuisineType` exact match; `categories` (comma-separated) → `categories: { $in: [...] }`; `name`/`tradeName` → case-insensitive regex on `tradeName`; `rating`/`minRating` → `averageRating: { $gte: value }` and `ratingCount: { $gte: 1 }`. Optional `limit` (default 50, max 100) and `skip`. If `lat` and `lng` are provided, results can be filtered/sorted by distance (Haversine) in memory; optional `radius` (km) filters to businesses within that distance. Geo can be optimized later with a 2dsphere index on `address.coordinates`.
- **By ID:** `Business.findById(businessId).select("-password").lean()`. Validate `businessId` with `isObjectIdValid([businessId])`.
- **Response**: 200 + JSON array or single object; 400/404 with `{ message: "..." }` when no data or invalid ID.

### 4.2 POST (create) and PATCH (update) — FormData

Both POST and PATCH use **FormData**, not JSON, because they can include an image file (`imageUrl`).

**Required fields (POST):**

- `tradeName`, `legalName`, `email`, `password`, `phoneNumber`, `taxNumber`, `subscription`, `currencyTrade`, `address` (JSON string).

**Required fields (PATCH):** same as POST but **password is optional** (only sent when changing it).

**Optional (both):**

- `contactPerson`, `imageUrl` (File).
- **Discovery and delivery:** `cuisineType` (string), `categories` (JSON array of strings), `averageRating` (0–5), `ratingCount` (non-negative), `acceptsDelivery` (boolean), `deliveryRadius` (non-negative number, e.g. km), `minOrder` (non-negative number). All optional. On PATCH, `averageRating`/`ratingCount`/`categories`/`deliveryRadius`/`minOrder` are validated as described in the route.

**PATCH only:**

- `metrics` (JSON string). If present, must match the structure expected by the schema and validation (see Metrics below).

**Address** is a JSON string in FormData. Parsed object must pass `objDefaultValidation(address, reqAddressFields, nonReqAddressFields)`:

- Required: `country`, `state`, `city`, `street`, `buildingNumber`, `postCode`.
- Optional: `region`, `additionalDetails`, `coordinates`.

**Enums:**

- `subscription`: from `subscriptionEnums` (e.g. `["Free", "Basic", "Premium", "Enterprise"]`).
- `currencyTrade`: from `currenctyEnums` (e.g. `["USD", "EUR", "CHF", ...]`).

**Uniqueness:** `legalName`, `email`, and `taxNumber` must be unique among businesses. Duplicate check is done with `Business.exists({ $or: [...] })`; on conflict the API returns 409.

**Password:** Stored hashed with `bcrypt` (e.g. `hash(password, 10)`). Only hashed on create or when a new password is sent on PATCH.

**Image:** Optional. Uploaded to Cloudinary under folder `/business/:businessId` via `uploadFilesCloudinary` (single file, `onlyImages: true`). On PATCH, a new image is uploaded first; then the old image is deleted with `deleteFilesCloudinary`. On DELETE business, the whole folder is removed with `deleteFolderCloudinary`.

---

## 5. Metrics (business KPIs and waste thresholds)

**Metrics** are optional and typically set/updated via PATCH. They are not required on create.

Structure (see `lib/interface/IBusiness.ts` and `lib/db/models/business.ts`):

- **Top-level percentages** (0–100):  
  `foodCostPercentage`, `beverageCostPercentage`, `laborCostPercentage`, `fixedCostPercentage`.
- **Nested** `supplierGoodWastePercentage`:  
  `veryLowBudgetImpact`, `lowBudgetImpact`, `mediumBudgetImpact`, `hightBudgetImpact`, `veryHightBudgetImpact` (each 0–100).

In **`[businessId]/route.ts`** PATCH, metrics are validated with:

- `objDefaultValidation(metrics, reqMetrics, [])` for the top-level keys.
- Then `objDefaultValidation(metrics.supplierGoodWastePercentage, reqSupplierGoodWastePercentage, [])` for the nested object.

The **`utils/validateBusinessMetrics.ts`** helper provides equivalent validation in a reusable way (checks object shape, allowed keys, numeric type, and 0–100 range). It is not currently imported in the PATCH handler but is the right place to centralize or extend metrics validation (e.g. sum of cost percentages = 100%) and can be used by other routes or server actions that accept metrics.

---

## 6. DELETE and cascade (transaction + Cloudinary)

DELETE runs in a **MongoDB transaction** (`mongoose.startSession()` + `startTransaction`). In parallel it deletes:

- `Business`
- `BusinessGood`, `DailySalesReport`, `Employee`, `Inventory`, `MonthlyBusinessReport`, `Notification`, `Order`, `Printer`, `Promotion`, `Purchase`, `SalesInstance`, `SalesPoint`, `Schedule`, `SupplierGood`, `Supplier`, `User`

(all by `businessId`). Then it **commits** the transaction. Only after a successful commit does it call `deleteFolderCloudinary` for `business/${businessId}`. If the transaction fails, it aborts and never deletes from Cloudinary. This keeps DB and Cloudinary consistent and avoids orphaned assets.

---

## 7. Shared utilities and dependencies

Used by the business routes:

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before any DB call (singleton, serverless-safe). |
| `@/lib/db/handleApiError` | Central 500 JSON error response for catch blocks. |
| `@/lib/utils/objDefaultValidation` | Validate objects against required/optional key lists (address, metrics). |
| `@/lib/utils/isObjectIdValid` | Validate `businessId` (and other IDs) before queries. |
| `@/lib/cloudinary/uploadFilesCloudinary` | Upload business image to `/business/:businessId`. |
| `@/lib/cloudinary/deleteFilesCloudinary` | Remove old image on PATCH when replacing. |
| `@/lib/cloudinary/deleteFolderCloudinary` | Remove business folder on DELETE. |
| `@/lib/interface/IBusiness` | Types for business, metrics, supplierGoodWastePercentage. |
| `@/lib/interface/IAddress` | Type for address object. |
| `@/lib/db/models/business` | Mongoose model. |
| `@/lib/enums` | `subscriptionEnums`, `currenctyEnums`. |

Other models are only used in DELETE for cascade (see list in section 6).

---

## 8. How other parts of the app use Business

### 8.1 Business is the tenant boundary (how everything “hangs” off it)

Across the backend, most domain models have a required `businessId` field referencing `Business` (e.g. `SalesPoint`, `SalesInstance`, `Employee`, `Inventory`, `Purchase`, etc.). This means:

- Queries almost always include `businessId` filtering (or use business-scoped endpoints like `/.../business/:businessId`).
- Deletes can be cascaded by filtering on `businessId` (see the DELETE cascade in `app/api/v1/business/[businessId]/route.ts`).

### 8.2 Authentication and “current business” context

- **Auth:** NextAuth Credentials provider validates `email` + `password` against the `Business` collection (`app/api/auth/[...nextauth]/options.ts`). That makes the **Business record the login identity** for the back-office/admin part of the app.
- **Current business selection:** the front-end keeps the “current business” context (at minimum `businessId`) in the Zustand store (`app/store/store.ts`).
- **Important implementation detail:** Most v1 endpoints **do not derive `businessId` from the session/JWT**. They expect `businessId` to be sent explicitly (either in the URL segment or request body). So the client must consistently pass the `businessId` it is operating on.

### 8.3 Onboarding flow (creating the Business)

Entry point (UI): `app/startBusiness/` (`StartBusinessPage` + `BusinessProfileForm` + react-hook-form + zod).

Intended flow:

1. User fills the onboarding form.
2. Front-end submits **FormData** to `POST /api/v1/business` (because the payload may contain an image file).
3. API validates required fields, validates address keys, validates enums, hashes password, uploads image (optional), and creates the `Business`.
4. User can then sign in with that business email/password through NextAuth credentials.

### 8.4 Day-to-day POS “sales” flow (Business → SalesPoint → SalesInstance → Orders → Reporting)

This is the core operational loop of the application, and `businessId` is the thread that ties it together.

#### A) Configure where sales happen: Sales points

- A `SalesPoint` represents **a place where customers can be served** (table/room/bar/etc.).
- It has `businessId`, and may be configured for self-ordering; the same QR can be used by staff to open the table or by customers to self-order when selfOrdering is enabled.

#### B) Open a live session for that sales point: Sales instances

- A `SalesInstance` is the **active check/tab** for a `SalesPoint` for a given day (guests count, status, responsible employee/customer, etc.).
- When an employee opens a sales instance via `POST /api/v1/salesInstances`, the route:
  - Validates `salesPointId`, `businessId`; identity (openedByUserId) from session.
  - Finds (or creates) the **open Daily Sales Report** for the business.
  - Creates the `SalesInstance` inside a MongoDB transaction.

**Key coupling:** the first sales instance of the day is what triggers creation of the daily report for that `businessId` (see `createDailySalesReport` used by the sales instance route).

#### C) Create the billable items: Orders

- Orders are created by employees through `POST /api/v1/orders` (customer self-ordering uses a different route).
- Internally, order creation:
  - Validates IDs (`businessId`, `salesInstanceId`, and each order’s `businessGoodId` and `addOns`); identity (createdByUserId) from session.
  - Creates orders in a transaction (`createOrders`).
  - Pushes a `salesGroup` entry into the `SalesInstance` with an `orderCode` and the created order IDs.
  - Updates inventory “dynamic count” for the supplier goods used as ingredients (ingredients are consumed when orders are created).

So, operationally:

- **Business** defines the tenant.
- **SalesPoint** defines the physical/digital spot.
- **SalesInstance** defines the active session/tab.
- **Order** defines the items and their status/billing.
- **DailySalesReport** accumulates day-level analytics and employee/self-ordering stats per business.

### 8.5 Supply chain flow (Business → Suppliers/SupplierGoods → Purchases → Inventory)

Business-scoped supply chain features are designed to ensure menu items can be costed and stock can be tracked.

- **Suppliers** and **SupplierGoods** are created per business (and queried via business routes like `/suppliers/business/:businessId`).
- **Purchases** represent receiving goods (one purchase = one receipt; multiple goods can be attached).
- **Inventory** is monthly: the API creates a new inventory for the business on the first day of the month (or when the system triggers it), closes the previous inventory, and tracks counts over time.

**Key coupling:** Orders consume ingredients, which updates the inventory dynamic counts; purchases typically increase stock counts; inventory snapshots reconcile real vs dynamic counts.

### 8.6 People and operations flow (Business → Employees/Users → Schedules/Notifications)

- **Employees** are scoped to a business and are used throughout the operational flow (opening sales instances, creating orders, appearing in daily reports).
- **Users** can reference an employee record via `employeeDetails` (linking an app user account to an employee role), and store notifications/read flags.
- **Schedules** and **Notifications** are also business-scoped features exposed under `/api/v1/.../business/:businessId` routes.

### 8.7 Admin / management UI navigation

- The `BusinessNavigation` component links to “business management” areas (details, default metrics, sales points, etc.).
- These pages typically drive API calls that are business-scoped (by path or by request body).

So: **any feature that is “per restaurant” must receive or derive `businessId` and pass it to these business routes or to other v1 routes that are keyed by `businessId`.**

---

## 9. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request.
2. **Validate IDs** with `isObjectIdValid` before `findById`, `findOne`, or delete.
3. **Use FormData** for any route that may accept a file (create/update business with image).
4. **Return consistent JSON**: success with 200/201 and relevant body; errors with appropriate status (400, 404, 409, 500) and a clear `message` or `especify`/`Error` from `handleApiError`.
5. **Do not return the password**: use `.select("-password")` on all reads.
6. **Enums**: Validate `subscription` and `currencyTrade` against `lib/enums` to avoid invalid values.
7. **Uniqueness**: Enforce unique `legalName`, `email`, `taxNumber` on create and update (excluding current document on PATCH).
8. **Address**: Validate with `objDefaultValidation` and the same required/optional address fields everywhere.
9. **Metrics**: Use `utils/validateBusinessMetrics` (or the same rules) wherever metrics are accepted; keep 0–100 and structure in sync with `IBusiness` and the Business model.
10. **Cascade deletes**: Keep the list of models in DELETE in sync with any new business-scoped collections; run deletes inside the same transaction and call Cloudinary only after commit.

---

## 10. Data model summary (for context)

- **Business** has: identity (tradeName, legalName, email, password, phoneNumber, taxNumber), address (embedded), currencyTrade, subscription, optional imageUrl, optional contactPerson, optional metrics.
- **Metrics** include cost percentages (food, beverage, labor, fixed) and a nested object for supplier good waste by budget impact level.
- **Address** follows `IAddress` / `addressSchema` (country, state, city, street, buildingNumber, postCode; optional region, additionalDetails, coordinates).

This README is the main context for how the business API works, how it fits into the app, and how to extend or integrate with it consistently.
