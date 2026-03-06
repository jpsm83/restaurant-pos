# Sales Instances API — `app/api/v1/salesInstances`

This folder contains the **REST API for the SalesInstance entity**: the **open table/session** (check or tab) at a **SalesPoint**. A sales instance is where **Orders** are grouped: staff (or a customer via self-ordering) opens a session for a table/bar/room, and all orders for that session are attached to it until the session is closed. Sales instances are **not** related to suppliers; they are the **core of the live service flow**: they trigger creation of the **Daily Sales Report** when the first instance of the day is opened, they drive order creation and billing, and they tie together sales point, employees/customers, and daily reporting.

This document describes how these routes and the create util work, how they interact with orders, daily reports, sales points, and the rest of the app, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **SalesInstance** = one open session at a **SalesPoint** for a **Business**: `dailyReferenceNumber`, `salesPointId`, `guests`, `salesInstanceStatus` (e.g. Occupied, Reserved, Closed), optional `openedByEmployeeId` or `openedByCustomerId`, optional `responsibleById`, `clientName`, and **salesGroup** (array of order groups: orderCode + ordersIds).
- **One open instance per table per day:** For a given day (dailyReferenceNumber), business, and sales point, there should be at most one sales instance that is not Closed. Creating a second one returns 409.
- **Daily report coupling:** The **first** sales instance of the day for a business triggers creation of the **Daily Sales Report** (open report for that day) if it does not exist. The daily reference number from that report is then used for all sales instances and orders created that day. Employees who open instances are added to the daily report’s employee list (via `addEmployeeToDailySalesReport`) when needed.
- **Orders:** Orders are created in the context of a sales instance (they reference it and are pushed into `salesGroup` with an orderCode). PATCH on a sales instance can apply discount, cancel orders, change billing/order status, close orders (payment), or transfer orders to another sales instance. The sales instance is not updated for `salesPointId` or `salesGroup` in PATCH; orders are created/updated via the orders API, which updates the instance’s salesGroup.
- **Self-ordering:** The route `POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId` implements the full flow: create sales instance (with `salesPointId` = the id from the QR/location), create orders, close orders (payment), and update the daily report’s self-ordering section. So one request = open table + place order + pay.

So: **Sales instances are the “open check” layer: they anchor orders to a place and a day, trigger daily reporting, and support both staff-driven and self-ordering flows.**

---

## 2. File structure

```
app/api/v1/salesInstances/
├── README.md                                    # This file — context for flow, patterns, and app integration
├── route.ts                                     # GET all sales instances | POST create (employee-opened)
├── [salesInstanceId]/
│   └── route.ts                                 # GET by id | PATCH (orders actions + instance fields) | DELETE (empty only)
├── business/
│   └── [businessId]/
│       └── route.ts                             # GET sales instances for a business
├── user/
│   └── [userId]/
│       └── route.ts                             # GET sales instances (by employee; path param is userId/employeeId)
├── selfOrderingLocation/
│   └── [selfOrderingLocationId]/
│       └── route.ts                             # POST — create instance + orders + close + update daily report (self-order flow)
└── utils/
    └── createSalesInstance.ts                   # Shared create logic: ensure employee in daily report, create document
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/salesInstances` | Returns all sales instances (populated: salesPoint, customer, employees, salesGroup.ordersIds + businessGoodsIds). 404 if none. |
| POST | `/api/v1/salesInstances` | Creates a sales instance (employee-opened). Body: **JSON**. Ensures daily report exists, no duplicate open instance for same (dailyRef, business, salesPoint), then createSalesInstance. Transaction. |
| GET | `/api/v1/salesInstances/business/:businessId` | Intended: list sales instances for the business. Filter by businessId when implemented. |
| GET | `/api/v1/salesInstances/user/:userId` | Intended: list sales instances for an employee (openedByEmployeeId or responsibleById). Path param used as employeeId; add filter when implemented. |
| GET | `/api/v1/salesInstances/:salesInstanceId` | Returns one sales instance by ID (same populates as list). Use findById(salesInstanceId) for correct behavior. |
| PATCH | `/api/v1/salesInstances/:salesInstanceId` | Update instance and/or run order actions: discount, cancel, change billing/order status, close orders (payment), transfer orders to another instance; update guests, salesInstanceStatus, responsibleById, clientName. Can delete empty Occupied instance if status is changed. Transaction. |
| DELETE | `/api/v1/salesInstances/:salesInstanceId` | Deletes instance only if it has no orders (salesGroup empty or missing). 404 otherwise. |
| POST | `/api/v1/salesInstances/selfOrderingLocation/:selfOrderingLocationId` | Self-order flow: create instance (salesPointId = selfOrderingLocationId, openedByCustomerId), create orders, close orders with payment, push to daily report selfOrderingSalesReport. Transaction. |

All responses are JSON. Errors use `handleApiError` (500) or explicit NextResponse with 400/404/409.

---

## 4. Request/response patterns and validation

### 4.1 GET (list, by id, by business, by user/employee)

- **DB:** `connectDb()` before first query.
- **Populate:** salesPointId (name, type, selfOrdering), openedByCustomerId (customerName), openedByEmployeeId / responsibleById / closedById (employeeName, currentShiftRole), salesGroup.ordersIds with businessGoodsIds (name, mainCategory, subCategory, allergens, sellingPrice). Order fields: billingStatus, orderStatus, orderGrossPrice, orderNetPrice, paymentMethod, allergens, promotionApplyed, discountPercentage, createdAt, businessGoodsIds.
- **List by business:** Intended filter `SalesInstance.find({ businessId })`. Ensure businessId is validated with isObjectIdValid.
- **List by employee:** Intended filter by openedByEmployeeId or responsibleById (path param is the employee/user id).
- **By ID:** Validate salesInstanceId; use findById(salesInstanceId) or findOne({ _id: salesInstanceId }) so a single document is returned.

### 4.2 POST (create — employee-opened) — JSON body + transaction

**Required:** `salesPointId`, `guests`, `openedByEmployeeId`, `businessId`.  
**Optional:** `salesInstanceStatus`, `clientName`.

- **Validation:** isObjectIdValid(salesPointId, openedByEmployeeId, businessId). Check SalesPoint and Employee exist.
- **Daily report:** Find open daily report for business; if none, call `createDailySalesReport(businessId, session)` to create it. Use its `dailyReferenceNumber` (or abort if create returned an error string).
- **Duplicate:** No existing sales instance with same dailyReferenceNumber, businessId, salesPointId and status not Closed (use `salesInstanceStatus: { $ne: "Closed" }` in the schema; the route currently uses `status` — align with schema field `salesInstanceStatus`). Return 409 if duplicate.
- **Create:** Build ISalesInstance and call `createSalesInstance(newSalesInstanceObj, session)`. That util ensures the opening employee is in the daily report’s employeesDailySalesReport (via addEmployeeToDailySalesReport if missing), then SalesInstance.create(..., { session }). Commit transaction.

### 4.3 createSalesInstance util

- **Signature:** `createSalesInstance(newSalesInstanceObj: ISalesInstance, session: ClientSession)`.
- **Required keys:** dailyReferenceNumber, salesPointId, guests, salesInstanceStatus, businessId.
- **Behavior:** If openedByEmployeeId is present, ensure that employee exists in the daily report for that dailyReferenceNumber and businessId; if not, call addEmployeeToDailySalesReport(openedByEmployeeId, businessId, session). Then SalesInstance.create(newSalesInstanceObj, { session }). Returns the created document or an error string.
- **Used by:** POST /salesInstances and POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId.

### 4.4 PATCH (update and order actions) — JSON body + transaction

**Body fields (all optional):** ordersIdsArr, discountPercentage, comments, cancel, ordersNewBillingStatus, ordersNewStatus, paymentMethodArr, toSalesInstanceId, guests, salesInstanceStatus, responsibleById, clientName.

- **Validation:** Validate salesInstanceId and any IDs in body (responsibleById, ordersIdsArr, toSalesInstanceId). Load sales instance; 404 if not found.
- **Special case:** If instance is Occupied and has no salesGroup (or empty) and the new status is not Reserved, the route can **delete** the instance (empty table cleanup) and return success.
- **Order actions (in order as applicable):**
  - **discountPercentage:** addDiscountToOrders(ordersIdsArr, discountPercentage, comments, session).
  - **cancel:** cancelOrders(ordersIdsArr, session).
  - **ordersNewBillingStatus:** changeOrdersBillingStatus(ordersIdsArr, ordersNewBillingStatus, session).
  - **ordersNewStatus:** changeOrdersStatus(ordersIdsArr, ordersNewStatus, session).
  - **paymentMethodArr:** validatePaymentMethodArray(paymentMethodArr); then closeOrders(ordersIdsArr, paymentMethodArr, session).
  - **toSalesInstanceId:** transferOrdersBetweenSalesInstances(ordersIdsArr, toSalesInstanceId, session).
- **Responsible employee change:** If responsibleById is set and different from openedByEmployeeId, ensure that employee is in the daily report (addEmployeeToDailySalesReport if not).
- **Instance update:** Set guests, salesInstanceStatus, clientName, responsibleById on the document; SalesInstance.updateOne({ _id: salesInstanceId }, { $set: updatedSalesInstanceObj }, { session }). Commit.

Note: salesPointId and salesGroup are not updated in this route; they are managed by the orders flow (orders are added to salesGroup when orders are created).

### 4.5 DELETE — empty instances only

- **Condition:** Delete only if the instance has no orders: `salesGroup` has length 0 or does not exist. Use deleteOne with filter `{ _id: salesInstanceId, $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }] }`. Return 404 if no document deleted.

### 4.6 POST selfOrderingLocation — full self-order flow

**Body:** `businessId`, `openedByCustomerId`, `ordersArr`, `paymentMethodArr`.

- **Validation:** Validate all IDs (businessId, openedByCustomerId, selfOrderingLocationId, and businessGoodsIds inside ordersArr). ordersArrValidation(ordersArr); validatePaymentMethodArray(paymentMethodArr). Customer must exist.
- **Transaction:** Create or get daily report (createDailySalesReport if needed). Create sales instance with salesPointId = selfOrderingLocationId, openedByCustomerId, guests: 1, salesInstanceStatus: "Occupied", clientName from customer. createSalesInstance(..., session). Create orders with createOrders(dailyReferenceNumber, ordersArr, undefined, openedByCustomerId, salesInstance._id, businessId, session). closeOrders(createdOrdersIds, paymentMethodArr, session). Then update DailySalesReport: push to selfOrderingSalesReport with customerId, paymentMethodArr, totals (totalSalesBeforeAdjustments, totalNetPaidAmount, totalCostOfGoodsSold), soldGoods. Commit.

---

## 5. How other parts of the app use Sales Instances

### 5.1 Orders

- **Orders** are created with a salesInstanceId and are pushed into that instance’s salesGroup (orderCode + ordersIds) by the orders create flow. Sales instance PATCH delegates to order utils: addDiscountToOrders, cancelOrders, changeOrdersBillingStatus, changeOrdersStatus, closeOrders, transferOrdersBetweenSalesInstances. So sales instances are the parent of orders for a given table/session.

### 5.2 Daily Sales Report

- **DailySalesReport** is created when the first sales instance of the day is created (createDailySalesReport). The dailyReferenceNumber links all instances and orders of that day. addEmployeeToDailySalesReport adds the opening (or responsible) employee to the report when they first appear. Self-ordering pushes into the report’s selfOrderingSalesReport. See daily sales reports API/README if present.

### 5.3 Sales points

- **SalesPoint** is required for a sales instance (salesPointId). The self-ordering route uses the path param (selfOrderingLocationId) as the sales point id — this matches the id embedded in the QR code generated when creating the sales point.

### 5.4 Business (tenant and cascade)

- Sales instances are scoped by **businessId**. When a **Business** is deleted, **SalesInstance** is deleted in the same transaction (SalesInstance.deleteMany({ businessId }, { session }) in business DELETE).

### 5.5 Employees and customers

- **openedByEmployeeId** / **openedByCustomerId**, **responsibleById**, **closedById** link to Employee and Customer. These drive who opened the table, who is responsible, and who placed a self-order; they also drive daily report employee entries.

### 5.6 No link to suppliers

- Sales instances are part of the **service and ordering** flow, not the supply chain. They do not reference suppliers, purchases, or inventory directly; inventory is updated when **orders** are created (business goods → ingredients → inventory).

---

## 6. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate salesInstanceId, businessId, salesPointId, employeeId, order IDs, toSalesInstanceId, etc. |
| `../dailySalesReports/utils/createDailySalesReport` | Create or get open daily report for the business. |
| `../dailySalesReports/utils/addEmployeeToDailySalesReport` | Add employee to daily report (used in createSalesInstance and PATCH when responsibleById changes). |
| `./utils/createSalesInstance` | Create sales instance document and ensure employee in daily report. |
| Order utils (discount, cancel, billing status, order status, close, transfer) | Called from PATCH to modify orders. |
| `@/lib/db/models/salesInstance` | SalesInstance model. |
| `@/lib/db/models/dailySalesReport` | Daily report for dailyReferenceNumber and selfOrderingSalesReport. |
| SalesPoint, Employee, Order, BusinessGood, Customer | Populates and existence checks. |
| `@/lib/interface/ISalesInstance` | Type for create/update. |

---

## 7. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with isObjectIdValid for all path and body IDs before queries or updates.
3. **Use a transaction** when creating a sales instance (daily report + createSalesInstance) or when PATCH runs multiple order operations and instance update; use the same session for all steps and commit only when all succeed.
4. **Daily report first:** When creating an instance, resolve or create the daily report and use its dailyReferenceNumber; ensure the opening (or responsible) employee is in the report when applicable.
5. **No duplicate open table:** Enforce at most one non-Closed sales instance per (dailyReferenceNumber, businessId, salesPointId); use schema field `salesInstanceStatus` (not `status`) for the duplicate check.
6. **DELETE only when empty:** Allow delete only when the instance has no orders (salesGroup empty or missing).
7. **List routes:** Filter GET by businessId or by employee (openedByEmployeeId / responsibleById) so list endpoints return the correct subset.
8. **Consistent JSON** responses and error messages.

---

## 8. Data model summary (for context)

- **SalesInstance:** dailyReferenceNumber (number), salesPointId (ref: SalesPoint), guests (number), salesInstanceStatus (enum, default Occupied), openedByEmployeeId / openedByCustomerId / responsibleById / closedById (refs), businessId (ref: Business), clientName, salesGroup (array of { orderCode, ordersIds[], createdAt }), closedAt.
- **salesGroup** is updated when orders are created (orders API pushes to the instance’s salesGroup).

This README is the main context for how the sales instances API works and how it ties into orders, daily reports, sales points, and the rest of the app.
