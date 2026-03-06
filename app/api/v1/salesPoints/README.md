# Sales Points API — `app/api/v1/salesPoints`

This folder contains the **REST API for the SalesPoint entity**: the **physical places where service happens** (tables, bar, rooms, seats). A **SalesPoint** is where a **SalesInstance** (open check/session) is created and where **Orders** are taken. Sales points are **not** related to suppliers; they belong to the **live service flow**: they define where customers are served, support optional **self-ordering via QR**, and are used by **Printers** for order routing (which printer gets which orders by category and sales point).

This document describes how these routes work, how they fit into the app (sales instances, orders, printers), and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **SalesPoint** = one place of service for a **Business**: name (e.g. "Table 101"), optional type (table, room, bar, seat), flags for **self-ordering** and **QR enabled**, and an optional **qrCode** (Cloudinary URL of the QR image). Each sales point has a required **businessId**.
- **SalesInstance link:** A **SalesInstance** (open table/session) has a required **salesPointId**. When staff (or a customer via QR) “opens” a table, they create a sales instance for that sales point. Orders are then tied to that sales instance and thus to the sales point.
- **QR code:** On **create**, the API generates a QR code (unique URL per sales point), uploads it to Cloudinary under the business folder, and stores the image URL in **qrCode**. The QR typically points to a self-ordering or “start session” flow (e.g. `.../salesInstances/selfOrderingLocationId/:id`). **qrEnabled** and **qrLastScanned** support enabling/disabling and tracking scans (e.g. timer on front end).
- **Printers:** **Printer** configuration uses **salesPointIds** to route orders (e.g. “send kitchen orders from these tables to this printer”). So sales points define **where** orders come from for print routing.

So: **Sales points are the “where” of service: they anchor sales instances and orders and tie into QR self-ordering and printer routing.**

---

## 2. File structure

```
app/api/v1/salesPoints/
├── README.md                    # This file — context for flow, patterns, and app integration
├── route.ts                     # GET all sales points | POST create sales point (with QR generation)
├── [salesPointId]/
│   └── route.ts                 # GET | PATCH | DELETE by salesPointId
└── utils/
    └── generateQrCode.ts        # Generates QR image (data URL → Cloudinary) for a business
```

- **`route.ts`** (no dynamic segment): list all sales points; create (JSON body, duplicate check, then QR generation and update; rollback delete if QR fails).
- **`[salesPointId]/route.ts`**: get one, update (PATCH name/type/selfOrdering/qrEnabled), delete (then remove QR image from Cloudinary).
- **`utils/generateQrCode.ts`**: builds a unique QR (URL with new ObjectId), uploads PNG to Cloudinary under `restaurant-pos/business/:businessId/salesLocationQrCodes`, returns secure_url (or error string).

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/salesPoints` | Returns all sales points. 400 if none. |
| POST | `/api/v1/salesPoints` | Creates a sales point. Body: **JSON**. After create, generates QR via `generateQrCode(businessId)` and updates the document with `qrCode`. If QR generation fails, deletes the new document and returns 500. |
| GET | `/api/v1/salesPoints/:salesPointId` | Returns one sales point by ID. 400/404 if invalid or not found. |
| PATCH | `/api/v1/salesPoints/:salesPointId` | Partial update: salesPointName, salesPointType, selfOrdering, qrEnabled. Duplicate name check within same business. |
| DELETE | `/api/v1/salesPoints/:salesPointId` | Deletes the sales point document, then deletes the QR image from Cloudinary using the stored `qrCode` URL. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/500.

---

## 4. Request/response patterns and validation

### 4.1 GET (list and by ID)

- **DB:** `connectDb()` before first query. `SalesPoint.find().lean()` or `SalesPoint.findById(salesPointId).lean()`.
- **Validation:** For by-ID route, `salesPointId` is validated with `isObjectIdValid([salesPointId])`.
- **Response:** 200 + JSON array or single object; 400 when no data or invalid ID (list returns 400 when empty; by-ID returns 400 when not found in current implementation).

### 4.2 POST (create) — JSON body + QR generation

**Required:** `salesPointName`, `businessId`.  
**Optional:** `salesPointType`, `selfOrdering` (default false), `qrEnabled` (default true).

- **Validation:** `businessId` with `isObjectIdValid`. Duplicate check: `SalesPoint.exists({ businessId, salesPointName })`; 400 if duplicate.
- **Create:** Build document and `SalesPoint.create(newSalesPoint)`.
- **QR:** Call `generateQrCode(businessId)`. The util generates a new ObjectId, builds a data URL for a URL that includes that id (e.g. `.../salesInstances/selfOrderingLocationId/:id`), uploads the PNG to Cloudinary (folder `restaurant-pos/business/:businessId/salesLocationQrCodes`, `public_id` = that id), and returns the Cloudinary secure_url. If the result is falsy or contains `"Failed"`, the API deletes the newly created sales point and returns 500 (rollback). Otherwise `SalesPoint.updateOne({ _id: salesPointCreated._id }, { $set: { qrCode: qrCode } })`.
- **Note:** The QR payload URL uses a **new random id** generated inside `generateQrCode`; that id is not stored on the sales point. The sales point stores only the **image URL**. The self-ordering/session flow that receives the id from the scanned URL is handled elsewhere (e.g. salesInstances/selfOrderingLocationId).

### 4.3 PATCH (update by salesPointId) — JSON body

- **Body:** `salesPointName`, `salesPointType`, `selfOrdering`, `qrEnabled` (all optional for partial update).
- **Duplicate name:** `SalesPoint.exists({ salesPointName, _id: { $ne: salesPointId }, businessId })`; 400 if duplicate. Load existing document to get `businessId` when checking.
- **Update:** Build partial object with only provided/changed fields; `SalesPoint.updateOne({ _id: salesPointId }, { $set: updatedSalesPoint })`.

### 4.4 DELETE (delete by salesPointId) — document then Cloudinary

- **Validation:** `isObjectIdValid([salesPointId])`. Load sales point; 404 if not found.
- **Delete document:** `SalesPoint.deleteOne({ _id: salesPointId })`. If `deletedCount === 0`, return 404.
- **Cloudinary:** If the document had a `qrCode` URL, call `deleteCloudinaryImage(qrCode)` to remove the image. If that returns not `true`, return 500 with the error message. The document is already deleted, so the QR asset is best-effort cleanup.

---

## 5. Utility: `generateQrCode`

- **Location:** `utils/generateQrCode.ts`.
- **Input:** `businessId` (ObjectId or string).
- **Behavior:** Generates a new ObjectId (`randomUniqueId`). Creates a QR code (via `qrcode` library) as data URL pointing to `http://localhost:3000/api/v1/salesInstances/selfOrderingLocationId/${randomUniqueId}`. Converts to buffer and uploads to Cloudinary with:
  - `folder`: `restaurant-pos/business/${businessId}/salesLocationQrCodes`
  - `public_id`: `randomUniqueId`
  - `upload_preset`: `"restaurant-pos"`
- **Returns:** Cloudinary `secure_url` string, or a string starting with `"Failed"` on error.
- **Usage:** Called after creating a sales point; the returned URL is stored in `salesPoint.qrCode`. The id embedded in the QR URL is used by the self-ordering/sales-instance flow when the QR is scanned (see salesInstances routes).

---

## 6. How other parts of the app use Sales Points

### 6.1 Sales instances (open sessions)

- **SalesInstance** has required **salesPointId** (ref: SalesPoint). Opening a table/session creates a SalesInstance for a sales point. Orders are grouped under that instance. So sales points are the “place” of each open check.

### 6.2 Orders

- Orders are created in the context of a **SalesInstance**, which is tied to a **salesPointId**. Order lists and flows often populate `salesPointId` (e.g. sales point name) for display and for routing (e.g. which printer by sales point).

### 6.3 Printers

- **Printer** has **configurationSetupToPrintOrders** with **salesPointIds**. Orders are routed to printers by category and by **sales point**; so sales points define which tables/areas send to which printer. See Printers README.

### 6.4 Business (tenant and cascade)

- Sales points are scoped by **businessId**. When a **Business** is deleted, **SalesPoint** is deleted in the same transaction (`app/api/v1/business/[businessId]/route.ts`). Cloudinary folder cleanup for the business (including QR images under the business folder) is handled at business level; per–sales-point QR delete in this API is for when a single sales point is removed.

### 6.5 No link to suppliers

- Sales points are part of the **service and ordering** flow, not the supply chain. They do not reference suppliers, purchases, or inventory.

---

## 7. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate salesPointId, businessId. |
| `./utils/generateQrCode` | Generate and upload QR image; return Cloudinary URL or error string. |
| `../../cloudinaryActions/utils/deleteCloudinaryImage` | Delete QR image from Cloudinary on DELETE sales point. |
| `@/lib/db/models/salesPoint` | SalesPoint model. |
| `@/lib/interface/ISalesPoint` | Type for create/update. |
| `qrcode` | Generate QR as data URL. |
| `cloudinary` (v2) | Upload QR image (configured with env vars). |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `salesPointId` and `businessId` before queries or updates.
3. **Uniqueness:** Enforce unique (businessId, salesPointName) on create and on PATCH (exclude current document when updating name).
4. **QR on create:** Generate QR after creating the document; if generation fails, delete the new document and return 500 so the DB does not hold a sales point without a valid QR when one is expected.
5. **DELETE order:** Delete the document first, then remove the Cloudinary asset. If Cloudinary fails, the document is already gone; return 500 so the caller knows the asset cleanup failed.
6. **Consistent JSON** responses and error messages.

---

## 9. Data model summary (for context)

- **SalesPoint:** `salesPointName` (required), `businessId` (required, ref: Business), optional `salesPointType`, `selfOrdering` (default false), `qrCode` (Cloudinary URL, set after create), `qrEnabled` (default true), optional `qrLastScanned`.

This README is the main context for how the sales points API works and how it ties into sales instances, orders, printers, and the rest of the app.
