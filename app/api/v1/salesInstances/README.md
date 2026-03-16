# Sales Instances API — `app/api/v1/salesInstances`

This folder contains the **REST API for the SalesInstance entity**: the **open table/session** (check or tab) at a **SalesPoint**. A sales instance is where **Orders** are grouped: staff opens a session from the **POS UI** or by **scanning the table’s QR** (open-table-only); customers can self-order via the same QR **only when the sales point has selfOrdering enabled**. All orders for that session are attached to it until the session is closed. Sales instances are **not** related to suppliers; they are the **core of the live service flow**: they trigger creation of the **Daily Sales Report** when the first instance of the day is opened, they drive order creation and billing, and they tie together sales point, employees/customers, and daily reporting.

This document describes how these routes and the create util work, how they interact with orders, daily reports, sales points, and the rest of the app, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **SalesInstance** = one open session at a **SalesPoint** for a **Business**: `dailyReferenceNumber`, `salesPointId`, `guests`, `salesInstanceStatus` (e.g. Occupied, Reserved, Closed), optional `openedByUserId` (ref User) and `openedAsRole` ('employee' | 'customer'), optional `responsibleByUserId`, `closedByUserId` (ref User), `clientName`, and **salesGroup** (array of order groups: orderCode + ordersIds).
- **One open instance per table per day:** For a given day (dailyReferenceNumber), business, and sales point, there should be at most one sales instance that is not Closed. Creating a second one returns 409.
- **Daily report coupling:** The **first** sales instance of the day for a business triggers creation of the **Daily Sales Report** (open report for that day) if it does not exist. The daily reference number from that report is then used for all sales instances and orders created that day. Users who open instances (as employee) or become responsible are added to the daily report via **addUserToDailySalesReport(userId, businessId, session)** when needed. **createSalesInstance** also adds **responsibleByUserId** to the report when it is provided (e.g. delivery instances with responsibleByUserId = DELIVERY_ATTRIBUTION_USER_ID).
- **Orders:** Orders are created in the context of a sales instance (they reference it and are pushed into `salesGroup` with an orderCode). PATCH on a sales instance can apply discount, cancel orders, change billing/order status, close orders (payment), or transfer orders to another sales instance. The sales instance is not updated for `salesPointId` or `salesGroup` in PATCH; orders are created/updated via the orders API, which updates the instance’s salesGroup.
- **Self-ordering:** The route `POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId` is the **customer** self-order flow (open + order + pay) and is **only allowed when the sales point has selfOrdering === true** (returns 400 otherwise). The route `POST .../selfOrderingLocation/:id/openTable` lets an **employee (on-duty)** scan the same QR to **open the table only** (no orders); identity from session.

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
│       └── route.ts                             # GET sales instances for a user (openedByUserId or responsibleByUserId)
├── selfOrderingLocation/
│   └── [selfOrderingLocationId]/
│       ├── route.ts                             # POST — customer self-order flow (open + orders + pay; requires sales point selfOrdering true)
│       └── openTable/
│           └── route.ts                         # POST — employee open table only (from QR; on-duty required)
└── utils/
    └── createSalesInstance.ts                   # Shared create logic: ensure employee in daily report, create document
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/salesInstances` | Returns all sales instances (populated: salesPoint, openedByUserId, responsibleByUserId, closedByUserId → User; salesGroup.ordersIds + businessGoodId, addOns). 404 if none. |
| POST | `/api/v1/salesInstances` | Creates a sales instance (employee-opened). Body: **JSON**. Identity from **session** (userId only; no employeeId in body). **Requires on-duty employee** for that business (403 otherwise). Ensures daily report exists, no duplicate open instance, then createSalesInstance with openedByUserId, openedAsRole: 'employee'. Transaction. |
| GET | `/api/v1/salesInstances/business/:businessId` | List sales instances for the business. Filter by businessId. |
| GET | `/api/v1/salesInstances/user/:userId` | List sales instances for a user: openedByUserId or responsibleByUserId equals path userId. |
| GET | `/api/v1/salesInstances/:salesInstanceId` | Returns one sales instance by ID (same populates as list). Use findById(salesInstanceId). |
| PATCH | `/api/v1/salesInstances/:salesInstanceId` | Update instance and/or run order actions: discount, cancel, change billing/order status, close orders (payment), transfer; update guests, salesInstanceStatus, responsibleByUserId, clientName. Can delete empty Occupied instance if status is changed. Transaction. |
| DELETE | `/api/v1/salesInstances/:salesInstanceId` | Deletes instance only if it has no orders (salesGroup empty or missing). 404 otherwise. |
| POST | `/api/v1/salesInstances/selfOrderingLocation/:selfOrderingLocationId` | **Customer** self-order flow: only when sales point has **selfOrdering === true** (400 otherwise). Rejects with **409** when the table already has an open (non-Closed) sales instance (e.g. staff-opened). Create instance (openedByUserId, openedAsRole: 'customer'), create orders, close with payment, push to selfOrderingSalesReport. On success, sends an order confirmation **email** (nodemailer, to the user's email) and an **in-app notification** (pushed to the User's inbox) so the customer can show proof of payment. Order confirmation is implemented in `lib/orderConfirmation` and triggered after commit (fire-and-forget). Transaction. |
| POST | `/api/v1/salesInstances/selfOrderingLocation/:selfOrderingLocationId/openTable` | **Employee** open table from QR. Body: `businessId`, optional `guests`. Session userId; employee must be **on-duty** for that business. Opens table only (openedByUserId, openedAsRole: 'employee'). 201 created instance, 409 duplicate, 403 not on-duty, 400 validation. |

All responses are JSON. Errors use `handleApiError` (500) or explicit NextResponse with 400/404/409.

---

## 4. Request/response patterns and validation

### 4.1 GET (list, by id, by business, by user/employee)

- **DB:** `connectDb()` before first query.
- **Populate:** salesPointId (name, type, selfOrdering), openedByUserId / responsibleByUserId / closedByUserId → User (e.g. personalDetails.firstName, lastName, username), salesGroup.ordersIds with businessGoodId and addOns (name, mainCategory, subCategory, allergens, sellingPrice). Order fields: billingStatus, orderStatus, orderGrossPrice, orderNetPrice, paymentMethod, allergens, promotionApplyed, discountPercentage, createdAt, businessGoodId, addOns.
- **List by business:** Filter `SalesInstance.find({ businessId })`. Validate businessId with isObjectIdValid.
- **List by user:** Filter `$or: [ { openedByUserId: userId }, { responsibleByUserId: userId } ]` (path param is userId).
- **By ID:** Validate salesInstanceId; use findById(salesInstanceId) or findOne({ _id: salesInstanceId }) so a single document is returned.

### 4.2 POST (create — employee-opened) — JSON body + transaction

**Required:** `salesPointId`, `guests`, `businessId`.  
**Optional:** `salesInstanceStatus`, `clientName`.  
**Identity:** From **session** only (getToken → token.id = userId). No employeeId in body.

- **Validation:** isObjectIdValid(salesPointId, businessId). Check SalesPoint exists. User identity from session (userId).
- **Employee check:** After connectDb(), resolve Employee by (userId, businessId); require employee exists and **onDuty** is true. If not, return 403 (e.g. "You must be an on-duty employee to open a table from the POS.").
- **Daily report:** Find open daily report for business; if none, call `createDailySalesReport(businessId, session)`. Use its `dailyReferenceNumber` (or abort if create returned an error string).
- **Duplicate:** No existing sales instance with same dailyReferenceNumber, businessId, salesPointId and salesInstanceStatus not Closed. Return 409 if duplicate.
- **Create:** Build newSalesInstanceObj with `openedByUserId: userId`, `openedAsRole: 'employee'`. Call `createSalesInstance(newSalesInstanceObj, session)`. That util ensures the opening user is in the daily report (addUserToDailySalesReport if missing), then SalesInstance.create(..., { session }). Commit transaction.

### 4.3 createSalesInstance util

- **Signature:** `createSalesInstance(newSalesInstanceObj: ISalesInstance, session: ClientSession)`.
- **Required keys:** dailyReferenceNumber, salesPointId, guests, salesInstanceStatus, businessId.
- **Behavior:** If openedByUserId and openedAsRole === 'employee', ensure that user exists in the daily report’s employeesDailySalesReport (by userId); if not, call addUserToDailySalesReport(openedByUserId, businessId, session). Then SalesInstance.create(newSalesInstanceObj, { session }). Returns the created document or an error string. No openedByEmployeeId/openedByCustomerId; use openedByUserId and openedAsRole.
- **Used by:** POST /salesInstances and POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId.

### 4.4 PATCH (update and order actions) — JSON body + transaction

**Body fields (all optional):** ordersIdsArr, discountPercentage, comments, cancel, ordersNewBillingStatus, voidReason, ordersNewStatus, paymentMethodArr, toSalesInstanceId, guests, salesInstanceStatus, responsibleByUserId, clientName.

- **Validation:** Validate salesInstanceId and any IDs in body (responsibleByUserId, ordersIdsArr, toSalesInstanceId). Load sales instance; 404 if not found.
- **Management-only actions:** **Discount**, **cancel**, and **ordersNewBillingStatus** (Void, Invitation) require the caller to have a **management role** (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor). Session userId → Employee.findOne({ userId, businessId }) for allEmployeeRoles; role must be in MANAGEMENT_ROLES (lib/constants). When setting **ordersNewBillingStatus** to **Void**, **voidReason** is required in the body (one of: waste, mistake, refund, other) and is stored on the order (e.g. in comments).
- **Special case:** If instance is Occupied and has no salesGroup (or empty) and the new status is not Reserved, the route can **delete** the instance (empty table cleanup) and return success.
- **Order actions (in order as applicable):** discountPercentage, cancel, ordersNewBillingStatus (with voidReason when Void), ordersNewStatus, paymentMethodArr (closeOrders), toSalesInstanceId (transfer).
- **Responsible user change:** If responsibleByUserId is set and different from openedByUserId, ensure that user is in the daily report (addUserToDailySalesReport(responsibleByUserId, businessId, session) if not).
- **Instance update:** Set guests, salesInstanceStatus, clientName, responsibleByUserId on the document; SalesInstance.updateOne(..., { $set: updatedSalesInstanceObj }, { session }). Commit.

Note: salesPointId and salesGroup are not updated in this route; they are managed by the orders flow (orders are added to salesGroup when orders are created).

### 4.5 DELETE — empty instances only

- **Condition:** Delete only if the instance has no orders: `salesGroup` has length 0 or does not exist. Use deleteOne with filter `{ _id: salesInstanceId, $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }] }`. Return 404 if no document deleted.

### 4.6 POST selfOrderingLocation — customer self-order flow

This POST is the **customer** flow (open table + place order + pay). It is **only allowed when the sales point has selfOrdering === true**; otherwise the route returns 400 (e.g. “Self-ordering is not available at this table”). If the table **already has an open (non-Closed) sales instance** (e.g. opened by staff), the route returns **409** with a message that the table is being served by staff and self-ordering is not available until the table is closed. For **employees** scanning the same QR to open the table only, use **POST .../selfOrderingLocation/:id/openTable** (see route table).

Additionally, customer self-ordering via QR **respects the business opening hours**:

- The route loads the `Business` for the given `businessId` and uses `isBusinessOpenNow(business)` (from `lib/utils/isBusinessOpenNow`) against `businessOpeningHours`.
- If the business is currently closed according to its configured opening hours, the API responds with 403 and a clear message (e.g. “Business is currently closed for service.”).
- Staff can still open tables via the POS/QR (openTable route) when on-duty; opening hours apply only to **customer** self-ordering.

**Body:** `businessId`, `ordersArr`, `paymentMethodArr`. Identity from **session** (userId).

- **Guard:** Load SalesPoint by selfOrderingLocationId; if not found or `selfOrdering !== true`, return 400. Ensure salesPoint.businessId matches body businessId.
- **Open-session guard:** Get open daily report for business; if it exists, check SalesInstance.exists for same dailyReferenceNumber, businessId, salesPointId, and salesInstanceStatus not Closed. If an open instance exists, return 409 ("Table is being served by staff. Self-ordering is not available until the table is closed.").
- **Validation:** Validate all IDs (businessId, selfOrderingLocationId, and each order’s businessGoodId and addOns). ordersArrValidation(ordersArr); validatePaymentMethodArray(paymentMethodArr).
- **Transaction:** Create or get daily report (createDailySalesReport if needed). Create sales instance with salesPointId = selfOrderingLocationId, openedByUserId: userId, openedAsRole: 'customer', guests: 1, salesInstanceStatus: "Occupied", clientName from User. createSalesInstance(..., session). Create orders, closeOrders, push to selfOrderingSalesReport. Commit.

### 4.7 POST selfOrderingLocation/:id/openTable — employee open table from QR

**Body:** `businessId` (required), `guests` (optional, default 1). Identity from **session** (userId).

- **Auth:** Employee must exist for (userId, businessId) and be **on-duty** (403 otherwise).
- **Validation:** isObjectIdValid(selfOrderingLocationId, businessId). SalesPoint must exist and its businessId must match body businessId.
- **Duplicate:** Same as POST /salesInstances — no non-Closed instance for same dailyReferenceNumber, businessId, salesPointId; 409 if duplicate.
- **Logic:** Get or create daily report, build ISalesInstance (openedByUserId, openedAsRole: 'employee', salesPointId = path param), createSalesInstance. Return 201 with created instance.

### 4.8 POST /salesInstances/delivery — home/delivery order flow

This POST is the **home/delivery** customer flow. It:

- Accepts in the JSON body:
  - `businessId` (required),
  - `ordersArr` (required) — same structure as other order-creation flows,
  - `paymentMethodArr` (required),
  - `deliveryAddress` (optional; if omitted, the user’s stored address is used when available).
- Requires an authenticated **User** session (`token.type === "user"`).
- Loads the `Business` and enforces:
  - `acceptsDelivery === true`,
  - `isDeliveryOpenNow(business)` using `deliveryOpeningWindows` (from `lib/utils/isBusinessOpenNow`); if false, returns 403 (“Delivery is currently unavailable.”).
- Resolves the **delivery sales point** (`salesPointType === "delivery"`) for that business and creates a `SalesInstance` with:
  - `salesPointId` = delivery sales point id,
  - `openedByUserId` = current user,
  - `openedAsRole = 'customer'`,
  - `responsibleByUserId = DELIVERY_ATTRIBUTION_USER_ID`.
- Creates orders, applies promotions, closes orders with the provided payment methods, updates inventory and low-stock notifications, and sends an order confirmation email + in-app notification via `sendOrderConfirmation`.

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

### 5.5 Users (attribution)

- **openedByUserId**, **openedAsRole**, **responsibleByUserId**, **closedByUserId** (ref User) drive who opened the table, who is responsible, and who closed. Display names come from User (personalDetails or username). Daily report entries use userId in employeesDailySalesReport and selfOrderingSalesReport.

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
| `../dailySalesReports/utils/addEmployeeToDailySalesReport` | addUserToDailySalesReport(userId, businessId, session) — add user to daily report (used in createSalesInstance and PATCH when responsibleByUserId changes). |
| `./utils/createSalesInstance` | Create sales instance document and ensure employee in daily report. |
| Order utils (discount, cancel, billing status, order status, close, transfer) | Called from PATCH to modify orders. |
| `@/lib/db/models/salesInstance` | SalesInstance model. |
| `@/lib/db/models/dailySalesReport` | Daily report for dailyReferenceNumber and selfOrderingSalesReport. |
| SalesPoint, User, Order, BusinessGood | Populates and existence checks. |
| `@/lib/interface/ISalesInstance` | Type for create/update. |

---

## 7. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with isObjectIdValid for all path and body IDs before queries or updates.
3. **Use a transaction** when creating a sales instance (daily report + createSalesInstance) or when PATCH runs multiple order operations and instance update; use the same session for all steps and commit only when all succeed.
4. **Daily report first:** When creating an instance, resolve or create the daily report and use its dailyReferenceNumber; ensure the opening (or responsible) employee is in the report when applicable.
5. **No duplicate open table:** Enforce at most one non-Closed sales instance per (dailyReferenceNumber, businessId, salesPointId); use schema field `salesInstanceStatus` (not `status`) for the duplicate check.
6. **DELETE only when empty:** Allow delete only when the instance has no orders (salesGroup empty or missing).
7. **List routes:** Filter GET by businessId or by user (openedByUserId / responsibleByUserId) so list endpoints return the correct subset.
8. **Consistent JSON** responses and error messages.

---

## 8. Data model summary (for context)

- **SalesInstance:** dailyReferenceNumber (number), salesPointId (ref: SalesPoint), guests (number), salesInstanceStatus (enum, default Occupied), openedByUserId / openedAsRole ('employee'|'customer') / responsibleByUserId / closedByUserId (ref User), businessId (ref: Business), clientName, salesGroup (array of { orderCode, ordersIds[], createdAt }), closedAt.
- **salesGroup** is updated when orders are created (orders API pushes to the instance’s salesGroup).

This README is the main context for how the sales instances API works and how it ties into orders, daily reports, sales points, and the rest of the app.
