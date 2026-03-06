# Users API — `app/api/v1/users`

This folder contains the **REST API for the User entity**: the **app-level identity** for people who interact with the POS. A **User** holds personal details (username, email, password, address, etc.), can be linked to an **Employee** (one-to-one), can have **self-orders** (when acting as a client), and maintains an **inbox** of **Notifications** with per-notification `readFlag` and `deletedFlag`.

Users are **recipients** of notifications (together with employees) and are the logical “customer” identity when the business sends messages to customers. They are **not** the same as the **Business** entity used for back-office login (see `app/api/auth/[...nextauth]` and business README).

This document describes how these routes work, how they fit into the app (employees, notifications, orders), and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **User** = one person in the system with `personalDetails` (credentials, name, id, address, optional image). Stored in the **User** collection; password is hashed with bcrypt and excluded from GET responses.
- **Employee linkage:** An **Employee** document has a required `userId` referencing **User**. So a user can “be” an employee; the app distinguishes “user as client” vs “user as employee” by the presence of that link and employee status (e.g. onDuty).
- **Notification inbox:** Each user has an optional `notifications[]` array: `{ notificationId, readFlag, deletedFlag }`. When a notification is created or updated with **customersRecipientsIds**, the notifications API pushes this entry into each recipient User’s `notifications` array. Users **do not** create or delete notification documents; they only update their own **inbox state** (read/deleted flags) via the sub-routes under `users/[userId]/`.
- **Self-orders:** The schema reserves `selfOrders` (array of Order refs) for orders made by the user when logged in as a client; the users API in this folder does not create or update orders.

So: **Users are the identity and inbox layer for “people” in the app; they link to employees, receive notifications, and (conceptually) to self-orders.**

---

## 2. File structure

```
app/api/v1/users/
├── README.md                                    # This file — context for flow, patterns, and app integration
├── route.ts                                     # GET all users | POST create user
├── [userId]/
│   └── route.ts                                 # GET | PATCH | DELETE by userId
│   ├── markNotificationAsDeleted/
│   │   └── route.ts                             # PATCH — set deletedFlag (and readFlag) for one notification in user inbox
│   └── updateReadFlag/
│       └── [notificationId]/
│           └── route.ts                         # PATCH — set readFlag true for one notification in user inbox
```

- **`route.ts`** (no dynamic segment): list all users (password excluded); create user (FormData, optional image, duplicate check, bcrypt hash).
- **`[userId]/route.ts`**: get one user (password excluded), update user (PATCH with FormData), delete user (guarded by employee link, then Cloudinary cleanup).
- **`[userId]/markNotificationAsDeleted/route.ts`**: body `{ notificationId }`; sets `notifications.$.deletedFlag` and `notifications.$.readFlag` to true for that notification in this user’s inbox. Transactional.
- **`[userId]/updateReadFlag/[notificationId]/route.ts`**: sets `notifications.$.readFlag` to true for the given notification. No transaction in current implementation.

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users` | Returns all users (password excluded). 404 if none. |
| POST | `/api/v1/users` | Creates a new user. Body: **FormData** (see below). Duplicate check on username, email, idNumber; password hashed; optional image upload. |
| GET | `/api/v1/users/:userId` | Returns one user by ID (password excluded). 404 if not found. |
| PATCH | `/api/v1/users/:userId` | Partial update of personal details. Body: **FormData**. Optional password change (hashed); optional image (upload new, delete old). |
| DELETE | `/api/v1/users/:userId` | Deletes user only if not blocked by employee link (see below). Removes Cloudinary folder `/users/:userId`. |
| PATCH | `/api/v1/users/:userId/markNotificationAsDeleted` | Body: `{ notificationId }`. Marks that notification as deleted and read in the user’s inbox. Transactional. |
| PATCH | `/api/v1/users/:userId/updateReadFlag/:notificationId` | Marks that notification as read in the user’s inbox. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns

### 4.1 GET (list and by ID)

- **DB:** `connectDb()` before first query.
- **Password:** Always excluded: `User.find({}, { "personalDetails.password": 0 }).lean()` or `User.findById(userId, { "personalDetails.password": 0 }).lean()`.
- **Validation:** For by-ID route, `userId` is validated with `isObjectIdValid([userId])`.
- **Response:** 200 + JSON array or single object; 404 when no data or not found.

### 4.2 POST (create) — FormData

**Required fields (FormData):**

- `username`, `email`, `password`, `idType`, `idNumber`, `address` (JSON string), `firstName`, `lastName`, `nationality`, `gender`, `birthDate`, `phoneNumber`

**Optional:** `imageUrl` (File).

**Validation:**

- **Address:** Parsed from JSON string; validated with `objDefaultValidation(address, reqAddressFields, nonReqAddressFields)` (same required/optional keys as elsewhere: country, state, city, street, buildingNumber, postCode; optional region, additionalDetails, coordinates).
- **Uniqueness:** `User.exists({ $or: [ { "personalDetails.username": username }, { "personalDetails.email": email }, { "personalDetails.idNumber": idNumber } ] })`. On conflict return 409.

**Password:** Hashed with `bcrypt.hash(password, 10)` before save.

**Image:** If provided, upload to Cloudinary folder `/users/:userId` (single file, `onlyImages: true`), store URL in `personalDetails.imageUrl`.

**Note:** The route generates `_id` before upload so the folder can include `userId`.

### 4.3 PATCH (update by userId) — FormData

- Same personal-details fields as POST; **password is optional** (only hashed and updated when provided).
- Duplicate check excludes current user: `User.exists({ _id: { $ne: userId }, $or: [ ... ] })`.
- Address: compare each key to existing and set only changed `personalDetails.address.*` fields.
- Image: upload new image, then delete old with `deleteFilesCloudinary(oldImageUrl)`, then set new URL.

### 4.4 DELETE (delete by userId) — guarded by Employee

- **Guard:** `Employee.findOne({ userId }).select("terminatedDate").lean()`. If an employee exists for this user **and** that employee has a **non-null terminatedDate**, the API returns 400 and does **not** delete (message: user cannot be deleted because he/she is employed). Otherwise the user document is deleted and the Cloudinary folder `/users/:userId` is removed with `deleteFolderCloudinary`.

So: deletion is **blocked** when the user is linked to an employee that has a termination date; deletion is **allowed** when there is no employee or the employee has no `terminatedDate` (implementation detail to align with product rules if needed).

### 4.5 Notification inbox sub-routes

- **markNotificationAsDeleted:** Body `{ notificationId }`. Validates `userId` and `notificationId` with `isObjectIdValid`. Ensures the notification document exists. In a transaction: `User.findOneAndUpdate({ _id: userId, "notifications.notificationId": notificationId }, { $set: { "notifications.$.deletedFlag": true, "notifications.$.readFlag": true } }, { session })`. Commit. The notification itself is not deleted; only the user’s inbox entry is marked.
- **updateReadFlag:** Path params `userId`, `notificationId`. Validates both; checks notification exists; `User.findOneAndUpdate({ _id: userId, "notifications.notificationId": notificationId }, { $set: { "notifications.$.readFlag": true } })`.

**Implementation note:** The folder is `[userId]`, so the dynamic param is `params.userId`. The handler in `markNotificationAsDeleted` uses `context.params.customerId`; that should be `context.params.userId` to match the route segment.

---

## 5. How other parts of the app use Users

### 5.1 Employees

- **Employee** has required `userId` (ref: User). So every employee is a user; the reverse is not true (a user can exist without an employee). When creating/editing employees, the app typically ensures a User exists and links it. The users DELETE route uses the Employee collection to decide whether the user can be deleted.

### 5.2 Notifications

- Notifications are created/updated in `app/api/v1/notifications`. Recipients can be **employees** (`employeesRecipientsIds`) and/or **customers** (`customersRecipientsIds`). When customers are recipients, the notification API pushes `{ notificationId }` into each **User**’s `notifications` array (users are the “customer” recipients). Users never create or delete notification documents; they only update their own `readFlag` and `deletedFlag` via the users sub-routes documented above.

### 5.3 Orders (self-orders)

- The User schema has `selfOrders` (array of Order refs) for when the user acts as a client. The users API in this folder does not create or update orders; that is done in the orders flow. The link is conceptual: the same identity (User) can be an employee and/or place self-orders.

### 5.4 Business and auth

- **Back-office login** is against **Business** (email + password), not User (see `app/api/auth/[...nextauth]/options.ts`). So “current session” for the POS admin is a Business. Users are a separate identity layer (e.g. for customer-facing or employee-linked accounts). Do not confuse User with the Business used for tenant login.

### 5.5 Cascade

- When a **Business** is deleted, the cascade list in `app/api/v1/business/[businessId]/route.ts` includes **User** (and Employee, etc.). So users can be removed as part of business deletion; the users API here is for direct CRUD and inbox updates, not for cascade logic.

---

## 6. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate userId, notificationId. |
| `@/lib/utils/objDefaultValidation` | Validate address object (required/optional keys). |
| `bcrypt.hash` | Hash password on create and when password is sent on PATCH. |
| `@/lib/cloudinary/uploadFilesCloudinary` | Upload user image to `/users/:userId`. |
| `@/lib/cloudinary/deleteFilesCloudinary` | Remove old image when replacing on PATCH. |
| `@/lib/cloudinary/deleteFolderCloudinary` | Remove user folder on DELETE. |
| `@/lib/db/models/user` | User model. |
| `@/lib/db/models/employee` | Check employee link and terminatedDate on DELETE. |
| `@/lib/db/models/notification` | Existence check in notification inbox routes. |
| `@/lib/interface/IUser`, `@/lib/interface/IPersonalDetails` | Types. |
| `personalDetailsSchema` | Embedded schema (username, email, password, idType, idNumber, address, firstName, lastName, nationality, gender, birthDate, phoneNumber, imageUrl). |

---

## 7. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `userId` and (where applicable) `notificationId` before queries.
3. **Never return the password:** use projection `{ "personalDetails.password": 0 }` on all GETs.
4. **Use FormData** for POST and PATCH when the payload may include a file (image).
5. **Address:** Validate with `objDefaultValidation` and the same required/optional address fields used elsewhere.
6. **Uniqueness:** Enforce unique username, email, and idNumber on create and on PATCH (excluding current document).
7. **Password:** Hash with bcrypt only on create or when a new password is sent on PATCH.
8. **Notification inbox:** Only update user-side flags (`readFlag`, `deletedFlag`); do not delete or modify the Notification document from the users API. Use a transaction when updating both notification existence check and user update if consistency is required.
9. **Cloudinary:** User images under `/users/:userId`; on DELETE user, remove folder with `deleteFolderCloudinary`.

---

## 8. Data model summary (for context)

- **User:** `personalDetails` (required): username, email, password, idType, idNumber, address, firstName, lastName, nationality, gender, birthDate, phoneNumber; optional imageUrl. Optional: `employeeDetails` (ref: Employee), `selfOrders` (refs: Order), `notifications` (array of `{ notificationId, readFlag, deletedFlag }`).
- **personalDetails** uses the same address structure as elsewhere (see `addressSchema` / `IAddress`).

This README is the main context for how the users API works and how it ties into employees, notifications, and the rest of the app.
