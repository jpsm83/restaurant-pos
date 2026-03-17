# Reservations API — `app/api/v1/reservations`

This folder contains the **REST API for Reservations**: the **booking layer** that sits on top of live service. Reservations are **scoped by `businessId`**, can be created by **customers** (pending approval) or by **staff** (confirmed immediately), and connect to **SalesPoints** (tables) and **SalesInstances** (the consuming session) once the guest is seated and starts ordering.

Reservations are **not related to suppliers**; they belong to the **service flow**: booking tables/rooms for a business and connecting that booking to the POS session when guests arrive.

---

## 1. Purpose and role in the application

- **Reservation** = a booked slot for a **Business**: date/time, guest count, optional description, and a **status lifecycle** (Pending → Confirmed → Arrived → Seated → Completed, with Cancelled/NoShow as terminals).
- **Scoping:** Reservations are scoped by `businessId`. When a **Business** is deleted, reservations are removed in the same DB transaction (`Reservation.deleteMany({ businessId }, { session })`).
- **Flow:** When staff seats a reservation, the system creates a **SalesInstance** for the assigned **SalesPoint**. The **bidirectional linkage** is finalized on the **first order** (so consumption can be attributed to a reservation).

So: **Reservations are the booking layer for the business: who is coming, when, and (optionally) which table/area, and how it connects to the live service (sales points / sales instances).**

---

## 2. File structure

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

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/reservations` | List reservations (optional query: businessId, startDate, endDate, status). |
| POST | `/api/v1/reservations` | Create reservation. Body: **JSON** (businessId, guestCount, reservationStart, optional reservationEnd/duration, description). Customer-created reservations start as **Pending** and trigger notifications/email. |
| GET | `/api/v1/reservations/business/:businessId` | List reservations for a business (optional date/status filters). |
| GET | `/api/v1/reservations/:reservationId` | Get one reservation. |
| PATCH | `/api/v1/reservations/:reservationId` | Update reservation (status lifecycle, salesPoint assignment, seating which creates SalesInstance, etc.). |
| DELETE | `/api/v1/reservations/:reservationId` | Delete or cancel reservation. |

Related SalesInstance helper route:

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/v1/salesInstances/:salesInstanceId/transferSalesPoint` | Move an open SalesInstance to a new SalesPoint and (if linked) keep `Reservation.salesPointId` in sync. |

All responses should be JSON. Use `handleApiError` for 500 and explicit `NextResponse` for 400/404/409, consistent with other v1 APIs.

---

## 4. How reservations fit with the rest of the app

### 4.1 Business (tenant and cascade)

- Every reservation must have a **businessId**. The **Business** DELETE handler already includes a commented call to `Reservation.deleteMany({ businessId }, { session })`; when the Reservation model exists, uncomment and add it to the transaction so reservations are removed with the business.

### 4.2 SalesPoint and SalesInstance (service flow)

- **SalesPoint** represents a table, room, bar, etc. A reservation can optionally reference a **salesPointId** (booked table) or leave it unset until assignment.
- **SalesInstance** is the “open session” at a sales point. When a reservation is “Seated,” the reservations API creates a SalesInstance (status `Reserved`) and stores its id on the reservation. On the **first order**, the orders create util sets `SalesInstance.reservationId` so consumption can be traced from both sides.
- **Table moves:** If host changes `Reservation.salesPointId`, the linked SalesInstance is also moved (same DB transaction). If server moves the SalesInstance, `/transferSalesPoint` also updates the reservation’s salesPoint.

### 4.3 Employees and Users (optional)

- Reservations can store an optional “created by” or “assigned to” employee, or a customer contact (userId or plain contact info). This can be added when defining the schema and routes.

### 4.4 Notifications (optional)

- The business could send notifications (e.g. reminder, confirmation) keyed by reservation; that would use the existing Notifications API and recipient model (employees/customers).

---

## 5. Patterns to follow when extending

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `reservationId`, `businessId`, `salesPointId` (and any other refs) before queries or updates.
3. **Scope by businessId** for list and create; enforce that reservation documents always have a valid `businessId` that exists.
4. **Use JSON body** for create/update unless you need file uploads (then use FormData like business/user routes).
5. **Return consistent JSON:** 200/201 with the resource or a clear message; 400/404/409 with a `message`; use `handleApiError` in catch blocks for 500.
6. **Cascade:** Reservations are deleted as part of the business delete transaction.
7. **Conflicts:** Table moves prevent moving into an already-occupied table (409). Reservation overlap is intentionally manager-controlled; conflict checks can be extended later.

---

## 6. Data model (implemented)

Reservation model lives in `lib/db/models/reservation.ts` and includes (key fields):

- **Required:** `businessId`, `createdByUserId`, `createdByRole` ("customer" | "employee"), `guestCount`, `reservationStart`.
- **Status enum:** `Pending`, `Confirmed`, `Arrived`, `Seated`, `Cancelled`, `NoShow`, `Completed`.
- **Optional:** `employeeResponsableByUserId`, `reservationEnd`, `description`, `salesPointId`, `salesInstanceId`.

---

## 7. Notifications and emails

- **Customer creates reservation** → status `Pending` and triggers:\n  - Customer email + in-app notification (“pending approval”).\n  - Managers-on-duty in-app notification (“action required”).\n- **Manager confirms/cancels** → triggers customer email + in-app notification with the decision.\n\nEmail uses the same SMTP config as `lib/orderConfirmation` (nodemailer).
