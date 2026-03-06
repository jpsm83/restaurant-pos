# Notifications API — `app/api/v1/notifications`

This folder contains the **REST API for the Notification entity**: messages and events emitted by a **Business** and delivered to recipients (employees and/or customers). Notifications are scoped by `businessId` and are designed to support **live-time operations** (warnings, emergencies, info, promotions, internal messages, etc.).

A key design principle in this codebase is that a **Notification is the immutable message/event**, while recipient-side state (read/deleted flags) is stored on the recipient’s document (currently implemented on `User.notifications`).

This document explains how the routes in this folder work, how they interact with the rest of the app, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **Operational communication layer:** Notifications provide a unified way to push operational information through the system (alerts, informational events, promotions, and internal messages).
- **Business-scoped feed:** Every notification is tied to a `businessId`. This supports multi-tenancy: a business only sees its own events.
- **Two-part delivery model:**
  - **Notification document:** stores `notificationType`, `message`, `businessId`, optional `senderId`, and the list of recipients.
  - **Recipient linkage:** recipients are updated with a pointer to the notification (`notifications[].notificationId`) so each recipient has an inbox feed.
- **Recipient state lives with the recipient:** flags like `readFlag` and `deletedFlag` are stored in the recipient’s `notifications` array (implemented on the `User` model). This prevents duplicating status state inside the Notification document itself.

So: **Notifications are the app’s event/message objects, and recipients maintain their own inbox state.**

---

## 2. File structure

```
app/api/v1/notifications/
├── README.md                      # This file — context for flow, patterns, and app integration
├── route.ts                       # GET all notifications | POST create notification
├── [notificationId]/
│   └── route.ts                   # GET | PATCH | DELETE by notificationId
├── business/
│   └── [businessId]/
│       └── route.ts               # GET notifications for a business
└── user/
    └── [userId]/
        └── route.ts               # GET notifications for a recipient (see “current implementation notes”)
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | Returns all notifications (populated recipients). 404 if none. |
| POST | `/api/v1/notifications` | Creates a new notification and links it into recipients (transaction). Body: **JSON**. |
| GET | `/api/v1/notifications/:notificationId` | Returns one notification by ID (populated recipients). 404 if not found. |
| PATCH | `/api/v1/notifications/:notificationId` | Updates a notification and reconciles recipient links (transaction). Body: **JSON**. |
| DELETE | `/api/v1/notifications/:notificationId` | Deletes the notification and removes links from recipients (transaction). |
| GET | `/api/v1/notifications/business/:businessId` | Returns notifications for a business. 404 if none. |
| GET | `/api/v1/notifications/user/:userId` | Intended to return notifications for a recipient (see “current implementation notes”). |

**Related (recipient state) routes live outside this folder:**

- `app/api/v1/users/[userId]/updateReadFlag/[notificationId]/route.ts` — sets `readFlag: true` on `User.notifications[]`.
- `app/api/v1/users/[userId]/markNotificationAsDeleted/route.ts` — sets `deletedFlag: true` (and `readFlag: true`) on `User.notifications[]`.

---

## 4. Core concepts: types, recipients, and status flags

### 4.1 Notification types (enum)

Notification types are constrained by `notificationEnums` (from `lib/enums.js`), e.g.:

- `Warning`, `Emergency`, `Info`, `Message`, `Promotion`, `Birthday`, `Event`

### 4.2 Recipients (employees vs customers)

The API enforces that a notification targets **exactly one recipient group** per request:

- Either `employeesRecipientsIds` **or** `customersRecipientsIds` must be provided
- Both cannot be set at the same time

### 4.3 Recipient-side read/deleted flags (inbox state)

Recipient state is modeled as an array of objects like:

- `notifications[] = { notificationId, readFlag, deletedFlag }`

This is currently implemented on the **`User`** model (`lib/db/models/user.ts`), and manipulated by the routes under `app/api/v1/users/...`.

---

## 5. Request/response patterns and transaction logic

### 5.1 GET (list / by ID / by business)

Common patterns:

- **DB:** always call `connectDb()` before queries.
- **Populate:** recipients are populated for readability:
  - `employeesRecipientsIds` → `Employee` (`employeeName`)
  - `customersRecipientsIds` → `Customer` (`customerName`)
- **Lean:** routes use `.lean()` to return plain objects.

Business-scoped feed:

- `GET /notifications/business/:businessId` validates `businessId` and filters by `{ businessId }`.

### 5.2 POST (create notification) — JSON body + transaction

`POST /notifications` does two atomic operations in a MongoDB transaction:

1. **Create the Notification** document with:
   - `notificationType`, `message`, `businessId`, optional `senderId`
   - exactly one of `employeesRecipientsIds` or `customersRecipientsIds`
2. **Link to recipients** by pushing `{ notificationId }` into each recipient’s `notifications` array.

It also validates:

- `businessId` and recipient IDs (and `senderId` if present) with `isObjectIdValid`
- existence of the business and recipients

This is important because without a transaction you could end up with:

- a notification that exists but is not visible in any recipient’s inbox
- inbox entries pointing to a notification that failed to be created

### 5.3 PATCH (update notification + reconcile recipients) — JSON body + transaction

`PATCH /notifications/:notificationId` updates both the Notification and recipient links in one transaction:

- Updates notification fields (`notificationType`, `message`, recipient list, optional `senderId`)
- Computes **added recipients**, **removed recipients**, and **unchanged recipients**
- Applies recipient updates:
  - `$push` notification for added recipients
  - `$pull` notification for removed recipients
  - If the message changes, resets `readFlag`/`deletedFlag` for unchanged recipients (so the updated message is treated as “unread”)

### 5.4 DELETE (delete notification + unlink from recipients) — transaction

`DELETE /notifications/:notificationId`:

1. Deletes the notification document
2. Pulls `{ notificationId }` from all recipients’ inbox arrays

This ensures there are no dangling inbox pointers to deleted notifications.

---

## 6. How other parts of the app use Notifications

### 6.1 Business and multi-tenancy

- Every notification is scoped to a `businessId`.
- When the **Business** is deleted, the business delete cascade deletes `Notification` documents as well (see `app/api/v1/business/[businessId]/route.ts` DELETE).

### 6.2 Employees / users and “inbox”

The intended flow is:

1. A notification is created for a set of recipients (employees or customers).
2. Each recipient receives an inbox entry `notifications[]` with `{ notificationId, readFlag, deletedFlag }`.
3. The UI reads the notification list for the current user and then fetches the Notification content as needed.
4. The UI updates `readFlag` and `deletedFlag` through the `app/api/v1/users/...` routes.

### 6.3 Live-time operations

Notifications are a natural integration point for:

- operational warnings/emergencies during service
- promotion broadcasts
- internal messages (via `senderId`)
- future real-time delivery mechanisms (websocket/SSE/polling) that can subscribe by `businessId`

---

## 7. Current implementation notes (important for further coding)

These are behaviors/constraints in the current code that matter when extending the system:

- **Customer model is referenced but not present in repo snapshot:** Several routes import `Customer` from `@/app/lib/models/customer`, but that file is not found in the current workspace. The routes rely on it for populates and recipient updates.
- **Recipient linkage is currently inconsistent across models:**
  - Notification POST/PATCH/DELETE update **Employee** or **Customer** documents by pushing/pulling into a `notifications` array.
  - The **Employee schema (`lib/db/models/employee.ts`) does not define `notifications`**.
  - The **User schema does define `notifications`**, and there are `users/...` routes that update read/deleted flags on `User.notifications`.
  - This suggests the intended inbox may be on `User` (and/or Customer), and the notification routes should likely update the same model that owns the inbox state.
- **`notifications/user/[userId]/route.ts` is misaligned:** It declares “employeeId” and queries `Notification.find({ recipientsId: employeeId })`, but the Notification schema uses `employeesRecipientsIds` / `customersRecipientsIds` (no `recipientsId` field). Treat this route as incomplete/incorrect until reconciled.
- **Schema detail:** `customersRecipientsIds` in `lib/db/models/notification.ts` is declared as an array of objects whose `type` is `[ObjectId]`, which effectively implies nested arrays. It likely should mirror `employeesRecipientsIds` (flat array of ObjectId refs).

Keeping these notes here prevents future work from silently “following the wrong data shape”.

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request.
2. **Validate IDs** with `isObjectIdValid` (notificationId, businessId, recipient arrays, senderId).
3. **Enforce exactly one recipient group** (employees or customers) per notification request.
4. **Use transactions** for create/update/delete since they must update both Notification and recipient links atomically.
5. **Keep recipient inbox state separate from Notification content** (`readFlag`/`deletedFlag` should remain on the recipient’s inbox entry).
6. **Return consistent JSON** responses and errors (`handleApiError` for 500, `NextResponse` for 400/404).
7. **Keep the schema + routes in sync** (recipient fields, customer model location, where inbox state is stored).

---

## 9. Data model summary (for context)

- **Notification** (`lib/db/models/notification.ts`):
  - `notificationType` (enum: `notificationEnums`)
  - `message` (string)
  - `employeesRecipientsIds` (ObjectId[] → Employee) **or** `customersRecipientsIds` (intended ObjectId[] → Customer)
  - `senderId` (optional ObjectId → Employee)
  - `businessId` (ObjectId → Business)
  - timestamps
- **User inbox state** (`lib/db/models/user.ts`):
  - `notifications[] = { notificationId, readFlag, deletedFlag }`

This README is the main context for how the notifications API works, how it fits into the app, and what to watch for when extending it.\n
