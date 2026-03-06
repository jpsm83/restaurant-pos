# Reservations API — `app/api/v1/reservations`

This folder is the **planned home of the Reservations API**. Reservations are part of the product vision (see `context.md`: “Reservations and other service workflows as the app expands”), and the business cascade delete already reserves a place for a future `Reservation` model (`app/api/v1/business/[businessId]/route.ts`: `// Reservation.deleteMany({ businessId }, { session }), TO BE CREATED`). At the moment **no route or model files exist** in this folder; this README describes the **intended role**, **integration points**, and **patterns** so that when the feature is implemented, it fits the rest of the app.

Reservations are **not related to suppliers**; they belong to the **service flow**: booking tables/rooms for a business, typically linked to **SalesPoint** (tables, bar, rooms) and potentially to **SalesInstance** when a reservation becomes a seated session.

---

## 1. Purpose and role in the application (intended)

- **Reservation** = a booked slot for a **Business**: date/time, guest count, optional contact, status (e.g. pending, confirmed, seated, cancelled, no-show), and typically a link to a **SalesPoint** (table/room) or a “to be assigned” state.
- **Scoping:** Reservations are scoped by `businessId` so they belong to one restaurant/location. When a **Business** is deleted, all its reservations should be removed in the same transaction (hence the placeholder in the business DELETE).
- **Flow:** A reservation can later become a **SalesInstance** (e.g. “seated” at a sales point); the exact handoff (reservation → open table/session) can be implemented when the API and UI are built.
- **UI:** The app already has a navigation entry to “Reservations” (`components/BusinessNavigation.tsx` → `/reservations`); the page and data will be backed by the API in this folder once it exists.

So: **Reservations are the booking layer for the business: who is coming, when, and (optionally) which table/area, and how it connects to the live service (sales points / sales instances).**

---

## 2. File structure (suggested for implementation)

When the feature is implemented, a structure in line with other v1 domains could look like:

```
app/api/v1/reservations/
├── README.md                    # This file — context and intended design
├── route.ts                     # GET all reservations (optional filters) | POST create reservation
├── [reservationId]/
│   └── route.ts                 # GET | PATCH | DELETE by reservationId
└── business/
    └── [businessId]/
        └── route.ts             # GET reservations for a business (optional date/status filters)
```

- **`route.ts`**: list (e.g. with query params for date range, status, businessId); create (body: date, time, guest count, businessId, optional salesPointId, contact, status).
- **`[reservationId]/route.ts`**: get one, update (e.g. status, time, sales point), delete (or “cancel” as status update).
- **`business/[businessId]/route.ts`**: list reservations for that business (same filters as above, scoped by businessId).

Optional additions as needed: `utils/` for validation (e.g. date/time, capacity), or nested routes (e.g. confirm, seat) if you prefer resource-oriented actions.

---

## 3. Route reference (intended)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/reservations` | List reservations (optional query: businessId, startDate, endDate, status). |
| POST | `/api/v1/reservations` | Create reservation. Body: **JSON** (businessId, reservationDate, time, guestCount, optional salesPointId, contact, status). |
| GET | `/api/v1/reservations/business/:businessId` | List reservations for a business (optional date/status filters). |
| GET | `/api/v1/reservations/:reservationId` | Get one reservation. |
| PATCH | `/api/v1/reservations/:reservationId` | Update reservation (e.g. status, time, sales point). |
| DELETE | `/api/v1/reservations/:reservationId` | Delete or cancel reservation. |

All responses should be JSON. Use `handleApiError` for 500 and explicit `NextResponse` for 400/404/409, consistent with other v1 APIs.

---

## 4. How reservations fit with the rest of the app

### 4.1 Business (tenant and cascade)

- Every reservation must have a **businessId**. The **Business** DELETE handler already includes a commented call to `Reservation.deleteMany({ businessId }, { session })`; when the Reservation model exists, uncomment and add it to the transaction so reservations are removed with the business.

### 4.2 SalesPoint and SalesInstance (service flow)

- **SalesPoint** represents a table, room, bar, etc. A reservation can optionally reference a **salesPointId** (booked table) or leave it unset until assignment.
- **SalesInstance** is the “open session” at a sales point. When a reservation is “seated,” the app may create or link a SalesInstance for that sales point; that logic can live in the reservations API (e.g. PATCH status to “Seated”) or in a shared service, and should stay consistent with how orders and daily reports work (see business README, section 8.4).

### 4.3 Employees and Users (optional)

- Reservations can store an optional “created by” or “assigned to” employee, or a customer contact (userId or plain contact info). This can be added when defining the schema and routes.

### 4.4 Notifications (optional)

- The business could send notifications (e.g. reminder, confirmation) keyed by reservation; that would use the existing Notifications API and recipient model (employees/customers).

---

## 5. Patterns to follow when implementing

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `reservationId`, `businessId`, `salesPointId` (and any other refs) before queries or updates.
3. **Scope by businessId** for list and create; enforce that reservation documents always have a valid `businessId` that exists.
4. **Use JSON body** for create/update unless you need file uploads (then use FormData like business/user routes).
5. **Return consistent JSON:** 200/201 with the resource or a clear message; 400/404/409 with a `message`; use `handleApiError` in catch blocks for 500.
6. **Cascade:** Add `Reservation.deleteMany({ businessId }, { session })` to the business DELETE transaction when the model exists.
7. **Uniqueness / conflicts:** If you need to avoid double-booking (e.g. same sales point, overlapping time), add validation and return 409 on conflict.

---

## 6. Data model (suggested for context)

When you introduce the **Reservation** model, it could include:

- **Required:** `businessId` (ref: Business), `reservationDate` (Date), `guestCount` (Number), `status` (e.g. string enum: Pending, Confirmed, Seated, Cancelled, NoShow).
- **Optional:** `salesPointId` (ref: SalesPoint), `time` or `slot`, `contactName`, `contactPhone`, `contactEmail`, `userId` (ref: User), `notes`, `createdByEmployeeId` (ref: Employee).

Indexes on `businessId`, `reservationDate`, and `status` will help list/filter performance.

---

## 7. Current status

- **No routes or models exist yet** in `app/api/v1/reservations`.
- **Business DELETE** has a placeholder for `Reservation.deleteMany({ businessId }, { session })` to be enabled once the model exists.
- **Navigation** already links to `/reservations`; the page can be wired to the API once it is implemented.

This README is the place to document the actual file structure, route table, and data model once the Reservations API is built, and to keep context for flow, boundaries, and app-wide integration.
