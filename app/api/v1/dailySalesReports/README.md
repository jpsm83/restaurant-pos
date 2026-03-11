# Daily Sales Reports API — `app/api/v1/dailySalesReports`

This folder contains the **REST API and shared logic for the Daily Sales Report entity**: one **day-level** report per business that aggregates sales by employee, payment methods, goods sold/void/invited, and business totals. Daily reports are **created when the first sales instance of the day is opened** (no separate “create report” call from the client). They are the **single place** where per-day sales analytics, employee performance, and business KPIs are computed and stored. They tie **Business**, **Sales Instances**, **Orders**, **Employees**, and (for self-ordering) **Customers** into a coherent reporting layer.

This document describes how the routes and utils work, how they follow and interact with other parts of the app (sales instances, orders, business, employees), the patterns and logic behind them, and why they matter for the system as a whole.

---

## 1. Purpose and role in the application

- **Daily Sales Report** = one document per **work day** per business. It has:
  - **dailyReferenceNumber**: Unix timestamp when the report was created (used as the “day” identifier; one work day can be closed the next calendar day).
  - **isDailyReportOpen**: whether the day is still open for new sales (true until manager/admin closes it).
  - **timeCountdownToClose**: limit time to close the report (e.g. 24 hours after creation).
  - **employeesDailySalesReport[]**: per-user breakdown keyed by **userId** (ref User): who served, payment methods, totals, tips, goods sold/void/invited. **Delivery** sales (sales instances whose sales point has `salesPointType === 'delivery'`) are attributed to a fixed system id **DELIVERY_ATTRIBUTION_USER_ID** (see `@/lib/constants`). That id has no real User document; when the client receives the report, **employeesDailySalesReport[].userId** may equal this id — the UI should display the label **"Delivery"** for that row and not rely on populated user data.
  - **selfOrderingSalesReport[]**: per-user self-ordering breakdown keyed by **userId** (ref User) (when customers self-order via QR, only when the sales point has selfOrdering enabled).
  - **Business-level totals**: dailyNetPaidAmount, dailyCostOfGoodsSold, dailyProfit, dailySoldGoods, dailyVoidedGoods, dailyInvitedGoods, businessPaymentMethods, dailyPosSystemCommission (by subscription), etc.
- **Creation:** The report is **not** created by a direct POST to this API. It is created by the **Sales Instance** flow: when the first sales instance of the day is opened for a business, the sales instance route finds or creates the **open** daily report (via `createDailySalesReport(businessId, session)`). That report’s `dailyReferenceNumber` is then stored on every sales instance and order for that day.
- **Users on the report:** When a user opens a sales instance as employee (or becomes responsible for one), they are added to the report’s `employeesDailySalesReport` via **addUserToDailySalesReport(userId, businessId, session)** so that later **calculate** routes can aggregate their sales. When a **delivery** sales instance is created (with **responsibleByUserId** = DELIVERY_ATTRIBUTION_USER_ID), that id is also added to the report so delivery sales are aggregated under one "Delivery" row. **calculateBusinessDailySalesReport** always includes DELIVERY_ATTRIBUTION_USER_ID in the list of userIds so the report has a Delivery row (with zeros if no delivery orders).
- **Calculation:** The report starts with empty employee arrays and no business totals. **Calculate** routes (per-user or whole business) run **updateEmployeesDailySalesReport(userIds, dailyReferenceNumber)**, which reads **SalesInstance** (by responsibleByUserId + dailyReferenceNumber), **Order** (by createdByUserId, createdAsRole: 'employee'), and **BusinessGood** data and recomputes per-user and then business-level aggregates. Only after **calculate** (and optionally **close**) does the report hold final numbers.

So: **Daily Sales Reports are the day-level analytics hub for the business: they are created by the sales flow, updated when employees/business totals are calculated, and closed by manager/admin when the day is done.**

---

## 2. File structure

```
app/api/v1/dailySalesReports/
├── README.md                    # This file — context for flow, patterns, and app integration
├── route.ts                     # GET all daily sales reports
├── business/
│   └── [businessId]/
│       └── route.ts             # GET reports by businessId (optional ?startDate&endDate)
├── [dailySalesReportId]/
│   └── route.ts                 # GET one report by ID | DELETE one (discouraged; see section 6)
│   ├── closeDailySalesReport/
│   │   └── route.ts             # PATCH — close the report (manager/admin only; no open orders)
│   ├── calculateUsersDailySalesReport/
│   │   └── route.ts             # PATCH — calculate user(s) daily sales (body: userIds)
│   └── calculateBusinessDailySalesReport/
│       └── route.ts             # PATCH — calculate all employees + business totals (manager/admin)
└── utils/
    ├── createDailySalesReport.ts        # Used by sales instances: create open report for business
    ├── addEmployeeToDailySalesReport.ts # addUserToDailySalesReport(userId, businessId, session) — used by sales instances
    └── updateEmployeeDailySalesReport.ts # updateEmployeesDailySalesReport(userIds, dailyReferenceNumber) — used by calculate routes
```

- **`route.ts`** (root): GET all daily sales reports (populated employeesDailySalesReport.userId, selfOrderingSalesReport.userId → User).
- **`business/[businessId]/route.ts`**: GET reports for a business, optionally filtered by `?startDate` and `?endDate`.
- **`[dailySalesReportId]/route.ts`**: GET one by ID; DELETE exists but is discouraged (see section 6).
- **`closeDailySalesReport`**: PATCH — set `isDailyReportOpen: false` (role check; no open orders allowed).
- **`calculateUsersDailySalesReport`**: PATCH — body: `userIds` (array). Run updateEmployeesDailySalesReport(userIds, dailyReferenceNumber); return updated user reports.
- **`calculateBusinessDailySalesReport`**: PATCH — no employeeId in body; auth from session (userId → Employee.findOne({ userId, businessId }) for role/onDuty). Run updateEmployeesDailySalesReport for all userIds from employeesDailySalesReport, then aggregate to business-level fields. Populate employeesDailySalesReport.userId → User for response.
- **Utils** are used by **sales instance** routes (`createDailySalesReport`, `addUserToDailySalesReport`) and by the **calculate** routes (`updateEmployeesDailySalesReport`).

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dailySalesReports` | Returns all daily sales reports (populated employeesDailySalesReport.userId, selfOrderingSalesReport.userId → User). 404 if none. |
| GET | `/api/v1/dailySalesReports/business/:businessId` | Returns reports for business. Optional `?startDate=&endDate=` (date range). 400 if startDate > endDate; 404 if none. |
| GET | `/api/v1/dailySalesReports/:dailySalesReportId` | Returns one report by ID (populated userId → User). 404 if not found. |
| DELETE | `/api/v1/dailySalesReports/:dailySalesReportId` | Deletes one report. **Discouraged** for data integrity; see section 6. |
| PATCH | `/api/v1/dailySalesReports/:dailySalesReportId/closeDailySalesReport` | Closes the report (sets isDailyReportOpen: false). **No body employeeId**; auth from session (userId → Employee.findOne({ userId, businessId }) for Manager/Admin/MoD, on duty). 400 if open orders exist. |
| PATCH | `/api/v1/dailySalesReports/:dailySalesReportId/calculateUsersDailySalesReport` | Recomputes user daily sales for given userIds. Body: `userIds` (array). Returns updated user reports; 207 if some errors. |
| PATCH | `/api/v1/dailySalesReports/:dailySalesReportId/calculateBusinessDailySalesReport` | Recomputes all users (from employeesDailySalesReport.userId) then business totals. **No body employeeId**; auth from session (userId → Employee for role/onDuty). Manager/Admin/etc., on duty. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/403/404/207.

---

## 4. Request/response patterns

### 4.1 GET (list, by business, by ID)

- **DB**: `connectDb()` before first query. Queries use `DailySalesReport.find()` or `findById()` with `.populate("employeesDailySalesReport.userId", "personalDetails.firstName personalDetails.lastName username")` and `.populate("selfOrderingSalesReport.userId", "personalDetails.firstName personalDetails.lastName username")` (User model).
- **Validation**: For routes with params, `businessId`, `dailySalesReportId` are validated with `isObjectIdValid(...)`.
- **Query params (business route):** `startDate`, `endDate` (e.g. `2023-04-01T00:00:00.000Z`). Converted to start-of-day and end-of-day UTC; `createdAt` is filtered `$gte` / `$lte`. If both provided, startDate must be ≤ endDate (400 otherwise).
- **Response**: 200 + JSON (array or single object); 404 when no data; 400 for invalid ID or invalid date range.

### 4.2 PATCH closeDailySalesReport

- **Body:** None for identity. Auth from **session**: getToken → token.id (userId). Resolve Employee by `Employee.findOne({ userId, businessId })` (report’s businessId); Employee must have `currentShiftRole` in allowed roles and `onDuty: true` (403 otherwise). Report must exist (404).
- **Business rule:** No **open orders** (billingStatus "Open") for that business and that report’s `dailyReferenceNumber`; otherwise 400.
- **Logic:** `DailySalesReport.updateOne(dailySalesReportId, { $set: { isDailyReportOpen: false } })`.
- **Response:** 200 success; 400 if open orders; 403 if not allowed; 404 if report not found; 500 if update modifiedCount === 0.

### 4.3 PATCH calculateUsersDailySalesReport

- **Body:** `{ userIds: Types.ObjectId[] }` (non-empty array).
- **Validation:** `isObjectIdValid([dailySalesReportId, ...userIds])`. Load report to get `dailyReferenceNumber`; 404 if report not found.
- **Logic:** Call **updateEmployeesDailySalesReport(userIds, dailyReferenceNumber)**. That util **replaces** the report’s `employeesDailySalesReport` with the recalculated array **only for the given userIds** — so if you pass a subset, the report will contain only those users (others are removed). For a full refresh, the client should pass all userIds currently on the report. Return the updated user reports.
- **Response:** 200 + updated user reports; 207 if partial errors; 400 for invalid IDs; 404 if report not found.

### 4.4 PATCH calculateBusinessDailySalesReport

- **Body:** None for identity. Auth from **session** (userId → Employee.findOne({ userId, businessId }) for Manager/Admin/etc. and on duty). Load report (with businessId for subscription); 404 if not found.
- **Logic:**
  1. Get all **userIds** from the report’s `employeesDailySalesReport` (each entry has userId).
  2. Call **updateEmployeesDailySalesReport(userIds, dailyReferenceNumber)** to refresh user data.
  3. Aggregate user reports into business-level fields: merge payment methods, sum totals, merge sold/void/invited goods, compute dailyProfit, dailyAverageCustomerExpenditure, dailyTotalVoidValue, dailyTotalInvitedValue.
  4. Compute **dailyPosSystemCommission** from dailyTotalSalesBeforeAdjustments × subscription percentage.
  5. **DailySalesReport.updateOne** with the aggregated object. Populate employeesDailySalesReport.userId → User for response.
- **Response:** 200 success; 207 if update had errors; 400 if not allowed or report not found.

---

## 5. Utils (used by this API and by sales instances)

### 5.1 createDailySalesReport

- **Signature:** `createDailySalesReport(businessId, session)`.
- **Purpose:** Create the **open** daily report for the business when the first sales instance of the day is opened. Called by the sales instance route when no open report exists for that business.
- **Logic:** Validate businessId. Set `dailyReferenceNumber = Date.now()`, `timeCountdownToClose = dailyReferenceNumber + 24h`, `isDailyReportOpen: true`, `employeesDailySalesReport: []`, `selfOrderingSalesReport: []`, `businessId`. `DailySalesReport.create([dailySalesReportObj], { session })`. Returns `dailyReferenceNumber` or an error string.
- **Callers:** `app/api/v1/salesInstances/route.ts` (POST — get or create open report), `app/api/v1/salesInstances/selfOrderingLocation/[selfOrderingLocationId]/route.ts` (self-order flow). Both use the returned dailyReferenceNumber for the new sales instance(s) and orders.

### 5.2 addUserToDailySalesReport (exported from addEmployeeToDailySalesReport.ts)

- **Signature:** `addUserToDailySalesReport(userId, businessId, session)`.
- **Purpose:** Ensure the user is in the open report’s `employeesDailySalesReport` so their sales can be attributed and calculated later.
- **Logic:** `DailySalesReport.findOneAndUpdate({ isDailyReportOpen: true, businessId }, { $addToSet: { employeesDailySalesReport: { userId } } }, { new: true, session })`. Returns true or an error string.
- **Callers:** `app/api/v1/salesInstances/utils/createSalesInstance.ts` (when openedAsRole === 'employee' — add openedByUserId if not already in report), `app/api/v1/salesInstances/[salesInstanceId]/route.ts` (PATCH when responsibleByUserId changes and the new responsible user is not yet in the report).

### 5.3 updateEmployeeDailySalesReport (updateEmployeesDailySalesReport)

- **Signature:** `updateEmployeesDailySalesReport(userIds, dailyReferenceNumber)` (no session; runs its own connectDb and a single update).
- **Purpose:** Recompute each listed user’s daily sales from **SalesInstance** (responsibleByUserId + dailyReferenceNumber), **Order** (createdByUserId, createdAsRole: 'employee', populated businessGoodId and addOns), and **BusinessGood**; then **replace** the report’s `employeesDailySalesReport` with the new array (entries keyed by userId).
- **Logic (summary):** For each userId: find SalesInstance where responsibleByUserId = userId and dailyReferenceNumber match; aggregate Orders (createdByUserId, createdAsRole: 'employee') for payment methods, totals, tips, cost; build sold/void/invited goods by billingStatus. Build IEmployeeDailySalesReport with userId. **DailySalesReport.updateOne** with the new employeesDailySalesReport array.
- **Returns:** `{ updatedEmployees: IEmployeeDailySalesReport[], errors: string[] }` or an error string. IEmployeeDailySalesReport uses **userId** (ref User).
- **Important:** The util **overwrites** `employeesDailySalesReport` with exactly the array for the **given** userIds. **calculateBusinessDailySalesReport** passes all userIds from the report so the full list is recalculated and kept.

---

## 6. DELETE and data integrity

- **DELETE** `/api/v1/dailySalesReports/:dailySalesReportId` exists but is **discouraged** for normal operation. Daily reports are kept for **historical and analytics**; the only intended bulk removal is when the **Business** is deleted (cascade in `app/api/v1/business/[businessId]/route.ts`).
- If you need to remove a report (e.g. data correction), use DELETE with care.

---

## 7. How daily sales reports interact with the rest of the app

### 7.1 Sales instances (creation and daily reference)

- When the **first** sales instance of the day is opened for a business (POST `/api/v1/salesInstances`), the route looks for an **open** daily report (`isDailyReportOpen: true`, same businessId). If none exists, it calls **createDailySalesReport(businessId, session)** inside the same transaction and uses the returned **dailyReferenceNumber** for the new sales instance.
- Every sales instance created that day stores that same **dailyReferenceNumber** so that orders and reports can attribute sales to the correct “work day.”
- When a sales instance is created, **createSalesInstance** ensures the opening user (when openedAsRole === 'employee') is in the report via **addUserToDailySalesReport(openedByUserId, businessId, session)**. When a sales instance’s **responsibleByUserId** is changed via PATCH, the route adds the new responsible user to the report if not already present.

### 7.2 Orders (source of totals and goods)

- **Orders** store `dailyReferenceNumber`, `billingStatus` (Open, Paid, Void, Invitation), `paymentMethod`, `orderGrossPrice`, `orderNetPrice`, `orderTips`, `orderCostPrice`, `businessGoodId` and `addOns` (populated with sellingPrice, costPrice). `orderNetPrice` already reflects **backend-validated promotions and manual discounts** at the moment of order creation.
- **updateEmployeesDailySalesReport** reads **SalesInstance** by responsibleByUserId and dailyReferenceNumber, and **Order** by createdByUserId and createdAsRole: 'employee', then aggregates payment methods, totals, and business goods into sold/void/invited by billingStatus. **Orders** (with validated net prices) are the source of truth; the daily report is the aggregated view.

### 7.3 Business (tenant and subscription)

- Every daily report has **businessId**. Reports are queried by business for list/filter (e.g. by date range).
- **calculateBusinessDailySalesReport** uses the business’s **subscription** (Free, Basic, Premium, Enterprise) to compute **dailyPosSystemCommission** (percentage of dailyTotalSalesBeforeAdjustments). So the report ties day-level revenue to the business’s plan.

- After a successful **calculateBusinessDailySalesReport** update, the route calls **aggregateDailyReportsIntoMonthly(businessId)** to refresh the current month's **Monthly Business Report**; aggregation errors are logged and do not fail the PATCH response.

### 7.4 Users and role checks

- **Users** are added to the report (employeesDailySalesReport with **userId**) when they open or become responsible for a sales instance as employee. For **closeDailySalesReport** and **calculateBusinessDailySalesReport**, the server gets userId from session and resolves **Employee** by `Employee.findOne({ userId, businessId })` to check **currentShiftRole** and **onDuty** (Manager/Admin/MoD/etc. only).
- User names are populated on GET (employeesDailySalesReport.userId → User: personalDetails.firstName, lastName, username).

### 7.5 Self-ordering

- **Self-ordering** flow creates sales instances with **openedByUserId**, **openedAsRole: 'customer'** and orders with **createdByUserId**, **createdAsRole: 'customer'**; it pushes into the report’s **selfOrderingSalesReport** with **userId**, payment methods, totals, soldGoods. User names are populated on GET (selfOrderingSalesReport.userId → User).

### 7.6 Summary flow

- **Open first table of the day** → create or get open daily report (createDailySalesReport) → store dailyReferenceNumber on sales instance and future orders.
- **User opens or becomes responsible (as employee)** → addUserToDailySalesReport so they appear in employeesDailySalesReport (by userId).
- **Orders created/closed** → data lives on Order and SalesInstance; report stays as-is until **calculate** is run.
- **Employee or manager runs calculate (users or business)** → updateEmployeeDailySalesReport recomputes from SalesInstance + Order + BusinessGood and updates the report.
- **Manager closes the day** → closeDailySalesReport (no open orders) sets isDailyReportOpen: false.

---

## 8. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response in catch blocks. |
| `@/lib/utils/isObjectIdValid` | Validate dailySalesReportId, businessId, userId, userIds. |
| `@/lib/interface/IDailySalesReport`, `IEmployeeDailySalesReport`, `IGoodsReduced` | Types for report and employee report. |
| `@/lib/interface/IPaymentMethod` | Payment method structure. |
| `@/lib/interface/IEmployee` | Employee currentShiftRole, onDuty for auth. |
| `@/lib/db/models/dailySalesReport` | Mongoose DailySalesReport model. |
| `@/lib/db/models/employee` | Role/onDuty checks via Employee.findOne({ userId, businessId }). |
| `@/lib/db/models/user` | Populate userId → User for display. |
| `@/lib/db/models/order` | Source of order totals and billing status. |
| `@/lib/db/models/businessGood` | Good name, sellingPrice, costPrice for goods aggregates. |
| `@/lib/db/models/salesInstance` | SalesInstance by responsibleByUserId + dailyReferenceNumber. |
| `@/lib/db/models/business` | Subscription for commission percentage. |

---

## 9. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request (or rely on utils that do).
2. **Validate IDs** with `isObjectIdValid` before find/update (dailySalesReportId, businessId, userId, userIds).
3. **Creation:** Do not expose a public POST to create a daily report; creation is triggered by the sales instance flow and uses createDailySalesReport inside a transaction.
4. **Role checks:** For close and calculateBusiness, get userId from session; resolve Employee by userId + businessId; require allowed roles and onDuty; return 400/403 with a clear message. No employeeId in request body.
5. **Close rule:** Do not allow closing if open orders exist for that business and dailyReferenceNumber (Order.exists billingStatus "Open").
6. **Calculate:** Pass **all** userIds from employeesDailySalesReport when doing a full business calculate so the report is not left with a partial list. calculateUsersDailySalesReport overwrites employeesDailySalesReport with only the passed userIds.
7. **Date range:** Use start-of-day and end-of-day when filtering by startDate/endDate; validate startDate ≤ endDate.
8. **Cascade:** Daily reports are deleted only as part of business cascade; avoid ad-hoc DELETE in normal flows.
9. **Populate:** Consistently populate employeesDailySalesReport.userId and selfOrderingSalesReport.userId with User (e.g. personalDetails.firstName, personalDetails.lastName, username) on GET for UI.

---

## 10. Data model summary (for context)

- **DailySalesReport:** businessId, dailyReferenceNumber (unique), isDailyReportOpen, timeCountdownToClose, employeesDailySalesReport[], selfOrderingSalesReport[], and (after calculate) businessPaymentMethods, dailyTotalSalesBeforeAdjustments, dailyNetPaidAmount, dailyTipsReceived, dailyCostOfGoodsSold, dailyProfit, dailyCustomersServed, dailyAverageCustomerExpenditure, dailySoldGoods, dailyVoidedGoods, dailyInvitedGoods, dailyTotalVoidValue, dailyTotalInvitedValue, dailyPosSystemCommission.
- **employeesDailySalesReport[]:** Each entry: **userId** (ref User), hasOpenSalesInstances, employeePaymentMethods[], totalSalesBeforeAdjustments, totalNetPaidAmount, totalTipsReceived, totalCostOfGoodsSold, totalCustomersServed, averageCustomerExpenditure, soldGoods, voidedGoods, invitedGoods (IGoodsReduced[]), totalVoidValue, totalInvitedValue.
- **IGoodsReduced:** businessGoodId, quantity, totalPrice, totalCostPrice.
- **selfOrderingSalesReport[]:** **userId** (ref User), customerPaymentMethod(s), totalSalesBeforeAdjustments, totalNetPaidAmount, totalCostOfGoodsSold, soldGoods.

This README is the main context for how the daily sales reports API and utils work, how they fit into the app (sales instances, orders, business, employees, self-ordering), and how to extend or integrate with them consistently.
