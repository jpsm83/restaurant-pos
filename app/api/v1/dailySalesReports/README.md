# Daily Sales Reports API — `app/api/v1/dailySalesReports`

This folder contains the **REST API and shared logic for the Daily Sales Report entity**: one **day-level** report per business that aggregates sales by employee, payment methods, goods sold/void/invited, and business totals. Daily reports are **created when the first sales instance of the day is opened** (no separate “create report” call from the client). They are the **single place** where per-day sales analytics, employee performance, and business KPIs are computed and stored. They tie **Business**, **Sales Instances**, **Orders**, **Employees**, and (for self-ordering) **Customers** into a coherent reporting layer.

This document describes how the routes and utils work, how they follow and interact with other parts of the app (sales instances, orders, business, employees), the patterns and logic behind them, and why they matter for the system as a whole.

---

## 1. Purpose and role in the application

- **Daily Sales Report** = one document per **work day** per business. It has:
  - **dailyReferenceNumber**: Unix timestamp when the report was created (used as the “day” identifier; one work day can be closed the next calendar day).
  - **isDailyReportOpen**: whether the day is still open for new sales (true until manager/admin closes it).
  - **timeCountdownToClose**: limit time to close the report (e.g. 24 hours after creation).
  - **employeesDailySalesReport[]**: per-employee breakdown (who served, payment methods, totals, tips, goods sold/void/invited).
  - **selfOrderingSalesReport[]**: per-customer self-ordering breakdown (when customers order via QR/self-order flow).
  - **Business-level totals**: dailyNetPaidAmount, dailyCostOfGoodsSold, dailyProfit, dailySoldGoods, dailyVoidedGoods, dailyInvitedGoods, businessPaymentMethods, dailyPosSystemCommission (by subscription), etc.
- **Creation:** The report is **not** created by a direct POST to this API. It is created by the **Sales Instance** flow: when the first sales instance of the day is opened for a business, the sales instance route finds or creates the **open** daily report (via `createDailySalesReport(businessId, session)`). That report’s `dailyReferenceNumber` is then stored on every sales instance and order for that day.
- **Employees on the report:** When an employee opens a sales instance (or becomes responsible for one), they are added to the report’s `employeesDailySalesReport` via **addEmployeeToDailySalesReport(employeeId, businessId, session)** so that later **calculate** routes can aggregate their sales.
- **Calculation:** The report starts with empty employee arrays and no business totals. **Calculate** routes (per-employee or whole business) run **updateEmployeesDailySalesReport(employeeIds, dailyReferenceNumber)**, which reads **SalesInstance** (by responsibleById + dailyReferenceNumber), **Order**, and **BusinessGood** data and recomputes per-employee and then business-level aggregates (payment methods, goods sold/void/invited, totals, tips, cost of goods). Only after **calculate** (and optionally **close**) does the report hold final numbers.

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
│   │   └── route.ts             # PATCH — calculate employee(s) daily sales (body: employeeIds)
│   └── calculateBusinessDailySalesReport/
│       └── route.ts             # PATCH — calculate all employees + business totals (manager/admin)
└── utils/
    ├── createDailySalesReport.ts        # Used by sales instances: create open report for business
    ├── addEmployeeToDailySalesReport.ts # Used by sales instances: add employee to report
    └── updateEmployeeDailySalesReport.ts # Used by calculate routes: recompute employee + report
```

- **`route.ts`** (root): GET all daily sales reports (populated employeeId, customerId).
- **`business/[businessId]/route.ts`**: GET reports for a business, optionally filtered by `?startDate` and `?endDate`.
- **`[dailySalesReportId]/route.ts`**: GET one by ID; DELETE exists but is discouraged (see section 6).
- **`closeDailySalesReport`**: PATCH — set `isDailyReportOpen: false` (role check; no open orders allowed).
- **`calculateUsersDailySalesReport`**: PATCH — run updateEmployeesDailySalesReport for given employeeIds; return updated employee reports.
- **`calculateBusinessDailySalesReport`**: PATCH — run updateEmployeesDailySalesReport for all employees on the report, then aggregate to business-level fields and update the report document.
- **Utils** are used by **sales instance** routes (`createDailySalesReport`, `addEmployeeToDailySalesReport`) and by the **calculate** routes (`updateEmployeeDailySalesReport`).

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dailySalesReports` | Returns all daily sales reports (populated employeeId, customerId). 404 if none. |
| GET | `/api/v1/dailySalesReports/business/:businessId` | Returns reports for business. Optional `?startDate=&endDate=` (date range). 400 if startDate > endDate; 404 if none. |
| GET | `/api/v1/dailySalesReports/:dailySalesReportId` | Returns one report by ID (populated). 404 if not found. |
| DELETE | `/api/v1/dailySalesReports/:dailySalesReportId` | Deletes one report. **Discouraged** for data integrity; see section 6. |
| PATCH | `/api/v1/dailySalesReports/:dailySalesReportId/closeDailySalesReport` | Closes the report (sets isDailyReportOpen: false). Body: `employeeId`. Manager/Admin/MoD, on duty. 400 if open orders exist. |
| PATCH | `/api/v1/dailySalesReports/:dailySalesReportId/calculateUsersDailySalesReport` | Recomputes employee daily sales for given employeeIds. Body: `employeeIds` (array). Returns updated employee reports; 207 if some errors. |
| PATCH | `/api/v1/dailySalesReports/:dailySalesReportId/calculateBusinessDailySalesReport` | Recomputes all employees then business totals (payment methods, goods, profit, commission). Body: `employeeId` (caller, for role check). Manager/Admin/ etc., on duty. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/403/404/207.

---

## 4. Request/response patterns

### 4.1 GET (list, by business, by ID)

- **DB**: `connectDb()` before first query. Queries use `DailySalesReport.find()` or `findById()` with `.populate("employeesDailySalesReport.employeeId", "employeeName")` and `.populate("selfOrderingSalesReport.customerId", "customerName")`.
- **Validation**: For routes with params, `businessId`, `dailySalesReportId` are validated with `isObjectIdValid(...)`.
- **Query params (business route):** `startDate`, `endDate` (e.g. `2023-04-01T00:00:00.000Z`). Converted to start-of-day and end-of-day UTC; `createdAt` is filtered `$gte` / `$lte`. If both provided, startDate must be ≤ endDate (400 otherwise).
- **Response**: 200 + JSON (array or single object); 404 when no data; 400 for invalid ID or invalid date range.

### 4.2 PATCH closeDailySalesReport

- **Body:** `{ employeeId }`.
- **Validation:** `isObjectIdValid([dailySalesReportId, employeeId])`. Employee must exist and have `currentShiftRole` in ["General Manager", "Manager", "Assistant Manager", "MoD", "Admin"] and `onDuty: true` (403 otherwise). Report must exist (404).
- **Business rule:** No **open orders** (billingStatus "Open") for that business and that report’s `dailyReferenceNumber`; otherwise 400.
- **Logic:** `DailySalesReport.updateOne(dailySalesReportId, { $set: { isDailyReportOpen: false } })`.
- **Response:** 200 success; 400 if open orders; 403 if not allowed; 404 if report not found; 500 if update modifiedCount === 0.

### 4.3 PATCH calculateUsersDailySalesReport

- **Body:** `{ employeeIds: Types.ObjectId[] }` (non-empty array).
- **Validation:** `isObjectIdValid([dailySalesReportId, ...employeeIds])`. Load report to get `dailyReferenceNumber`; 404 if report not found.
- **Logic:** Call **updateEmployeesDailySalesReport(employeeIds, dailyReferenceNumber)**. That util **replaces** the report’s `employeesDailySalesReport` with the recalculated array **only for the given employeeIds** — so if you pass a subset of employees, the report will contain only those employees in `employeesDailySalesReport` (others are removed). For a full refresh of all employees without wiping others, the client should pass all employee IDs currently on the report. Return the `updatedEmployees` array.
- **Response:** 200 + updated employee reports; 207 if `result.errors.length > 0` (partial success); 400 for invalid IDs; 404 if report not found.

### 4.4 PATCH calculateBusinessDailySalesReport

- **Body:** `{ employeeId }` (caller, for authorization).
- **Validation:** Employee must be Manager/Admin/ etc. and on duty (400 otherwise). Load report (with businessId populated for subscription); 404 if not found.
- **Logic:**
  1. Get all employee IDs from the report’s `employeesDailySalesReport`.
  2. Call **updateEmployeesDailySalesReport(employeeIds, dailyReferenceNumber)** to refresh employee data.
  3. Aggregate employee reports into business-level fields: merge payment methods, sum totals (dailyTotalSalesBeforeAdjustments, dailyNetPaidAmount, dailyTipsReceived, dailyCostOfGoodsSold, dailyCustomersServed), merge sold/void/invited goods by businessGoodId, compute dailyProfit, dailyAverageCustomerExpenditure, dailyTotalVoidValue, dailyTotalInvitedValue.
  4. Compute **dailyPosSystemCommission** from dailyTotalSalesBeforeAdjustments × subscription-based percentage (Free 0, Basic 5%, Premium 8%, Enterprise 10%).
  5. **DailySalesReport.updateOne** with the aggregated object (businessPaymentMethods, dailySoldGoods, dailyVoidedGoods, dailyInvitedGoods, etc.).
- **Response:** 200 success; 207 if employee update had errors; 400 if not allowed or report not found.

---

## 5. Utils (used by this API and by sales instances)

### 5.1 createDailySalesReport

- **Signature:** `createDailySalesReport(businessId, session)`.
- **Purpose:** Create the **open** daily report for the business when the first sales instance of the day is opened. Called by the sales instance route when no open report exists for that business.
- **Logic:** Validate businessId. Set `dailyReferenceNumber = Date.now()`, `timeCountdownToClose = dailyReferenceNumber + 24h`, `isDailyReportOpen: true`, `employeesDailySalesReport: []`, `selfOrderingSalesReport: []`, `businessId`. `DailySalesReport.create([dailySalesReportObj], { session })`. Returns `dailyReferenceNumber` or an error string.
- **Callers:** `app/api/v1/salesInstances/route.ts` (POST — get or create open report), `app/api/v1/salesInstances/selfOrderingLocation/[selfOrderingLocationId]/route.ts` (self-order flow). Both use the returned dailyReferenceNumber for the new sales instance(s) and orders.

### 5.2 addEmployeeToDailySalesReport

- **Signature:** `addEmployeeToDailySalesReport(employeeId, businessId, session)`.
- **Purpose:** Ensure the employee is in the open report’s `employeesDailySalesReport` so their sales can be attributed and calculated later.
- **Logic:** `DailySalesReport.findOneAndUpdate({ isDailyReportOpen: true, businessId }, { $addToSet: { employeesDailySalesReport: { employeeId } } }, { new: true, session })`. Returns true or an error string.
- **Callers:** `app/api/v1/salesInstances/utils/createSalesInstance.ts` (when creating a sales instance — add openedByEmployeeId or responsibleById if not already in report), `app/api/v1/salesInstances/[salesInstanceId]/route.ts` (PATCH when responsibleById changes and the new responsible employee is not yet in the report).

### 5.3 updateEmployeeDailySalesReport

- **Signature:** `updateEmployeesDailySalesReport(employeeIds, dailyReferenceNumber)` (no session; runs its own connectDb and a single update).
- **Purpose:** Recompute each listed employee’s daily sales from **SalesInstance** (responsibleById + dailyReferenceNumber), **Order** (populated businessGoodsIds), and **BusinessGood**; then **replace** the report’s `employeesDailySalesReport` with the new array.
- **Logic (summary):**
  - For each employeeId: find SalesInstance where responsibleById = employeeId and dailyReferenceNumber = dailyReferenceNumber; populate salesGroup.ordersIds → Order (paymentMethod, billingStatus, orderGrossPrice, orderNetPrice, orderTips, orderCostPrice, businessGoodsIds → BusinessGood with sellingPrice, costPrice).
  - For each order: aggregate payment methods into employeePaymentMethods; add to totalNetPaidAmount, totalTipsReceived, totalSalesBeforeAdjustments, totalCostOfGoodsSold; for each businessGood in the order, push to goodsSold / goodsVoid / goodsInvited according to order.billingStatus (Paid / Void / Invitation). Sum guests into totalCustomersServed. Set hasOpenSalesInstances if any instance has status !== "Closed".
  - Compute averageCustomerExpenditure, totalVoidValue, totalInvitedValue. Build IEmployeeDailySalesReport (soldGoods, voidedGoods, invitedGoods).
  - After processing all employeeIds, **DailySalesReport.updateOne({ dailyReferenceNumber }, { $set: { employeesDailySalesReport: employeeReports } })**.
- **Returns:** `{ updatedEmployees: IEmployeeDailySalesReport[], errors: string[] }` or an error string. Used by calculateUsersDailySalesReport and calculateBusinessDailySalesReport.
- **Important:** The util **overwrites** `employeesDailySalesReport` with exactly the array of recalculated employees for the **given** employeeIds. So if you call it with only [empA, empB], the report will end up with only A and B in employeesDailySalesReport; other employees previously on the report are removed. **calculateBusinessDailySalesReport** therefore passes **all** employee IDs from the report so the full list is recalculated and kept.

---

## 6. DELETE and data integrity

- **DELETE** `/api/v1/dailySalesReports/:dailySalesReportId` exists but is **discouraged** for normal operation. Daily reports are kept for **historical and analytics**; the only intended bulk removal is when the **Business** is deleted (cascade in `app/api/v1/business/[businessId]/route.ts`).
- If you need to remove a report (e.g. data correction), use DELETE with care.

---

## 7. How daily sales reports interact with the rest of the app

### 7.1 Sales instances (creation and daily reference)

- When the **first** sales instance of the day is opened for a business (POST `/api/v1/salesInstances`), the route looks for an **open** daily report (`isDailyReportOpen: true`, same businessId). If none exists, it calls **createDailySalesReport(businessId, session)** inside the same transaction and uses the returned **dailyReferenceNumber** for the new sales instance.
- Every sales instance created that day stores that same **dailyReferenceNumber** so that orders and reports can attribute sales to the correct “work day.”
- When a sales instance is created, **createSalesInstance** ensures the opening (or responsible) employee is in the report via **addEmployeeToDailySalesReport(employeeId, businessId, session)**. When a sales instance’s **responsibleById** is changed via PATCH, the route adds the new responsible employee to the report if not already present.

### 7.2 Orders (source of totals and goods)

- **Orders** store `dailyReferenceNumber`, `billingStatus` (Open, Paid, Void, Invitation), `paymentMethod`, `orderGrossPrice`, `orderNetPrice`, `orderTips`, `orderCostPrice`, `businessGoodsIds` (with quantity, sellingPrice, costPrice). They are grouped under **SalesInstance** via `salesGroup.ordersIds`.
- **updateEmployeeDailySalesReport** reads **SalesInstance** by responsibleById and dailyReferenceNumber, then for each instance’s orders aggregates payment methods, totals, and business goods into sold/void/invited by billingStatus. So: **orders are the source of truth for what was sold/void/invited; the daily report is the aggregated view.**

### 7.3 Business (tenant and subscription)

- Every daily report has **businessId**. Reports are queried by business for list/filter (e.g. by date range).
- **calculateBusinessDailySalesReport** uses the business’s **subscription** (Free, Basic, Premium, Enterprise) to compute **dailyPosSystemCommission** (percentage of dailyTotalSalesBeforeAdjustments). So the report ties day-level revenue to the business’s plan.

### 7.4 Employees (who is on the report and role checks)

- **Employees** are added to the report when they open or become responsible for a sales instance. Their **currentShiftRole** and **onDuty** are used in **closeDailySalesReport** and **calculateBusinessDailySalesReport** to allow only Manager/Admin/MoD/etc. to close or run business-level calculation.
- Employee names are populated on GET for display (employeesDailySalesReport.employeeId → employeeName).

### 7.5 Self-ordering (customers)

- **Self-ordering** flow creates sales instances and orders with **openedByCustomerId**; it can push into the report’s **selfOrderingSalesReport** (customerId, payment methods, totals, soldGoods). Customer names are populated on GET (selfOrderingSalesReport.customerId → customerName).

### 7.6 Summary flow

- **Open first table of the day** → create or get open daily report (createDailySalesReport) → store dailyReferenceNumber on sales instance and future orders.
- **Employee opens or becomes responsible** → addEmployeeToDailySalesReport so they appear in employeesDailySalesReport.
- **Orders created/closed** → data lives on Order and SalesInstance; report stays as-is until **calculate** is run.
- **Employee or manager runs calculate (users or business)** → updateEmployeeDailySalesReport recomputes from SalesInstance + Order + BusinessGood and updates the report.
- **Manager closes the day** → closeDailySalesReport (no open orders) sets isDailyReportOpen: false.

---

## 8. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response in catch blocks. |
| `@/lib/utils/isObjectIdValid` | Validate dailySalesReportId, businessId, employeeId, employeeIds. |
| `@/lib/interface/IDailySalesReport`, `IEmployeeDailySalesReport`, `IGoodsReduced` | Types for report and employee report. |
| `@/lib/interface/IPaymentMethod` | Payment method structure. |
| `@/lib/interface/IEmployee` | Employee currentShiftRole, onDuty for auth. |
| `@/lib/db/models/dailySalesReport` | Mongoose DailySalesReport model. |
| `@/lib/db/models/employee` | Populate employee name; role/onDuty checks. |
| `@/lib/db/models/order` | Source of order totals and billing status. |
| `@/lib/db/models/businessGood` | Good name, sellingPrice, costPrice for goods aggregates. |
| `@/lib/db/models/salesInstance` | SalesInstance by responsibleById + dailyReferenceNumber. |
| `@/lib/db/models/business` | Subscription for commission percentage. |
| `@/app/lib/models/customer` | Populate customer name for self-ordering. |

---

## 9. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request (or rely on utils that do).
2. **Validate IDs** with `isObjectIdValid` before find/update (dailySalesReportId, businessId, employeeId, employeeIds).
3. **Creation:** Do not expose a public POST to create a daily report; creation is triggered by the sales instance flow and uses createDailySalesReport inside a transaction.
4. **Role checks:** For close and calculateBusiness, require allowed roles (General Manager, Manager, Assistant Manager, MoD, Admin) and onDuty; return 400/403 with a clear message.
5. **Close rule:** Do not allow closing if open orders exist for that business and dailyReferenceNumber (Order.exists billingStatus "Open").
6. **Calculate:** Pass **all** employee IDs from the report when doing a full business calculate so the report is not left with a partial employee list. Document that calculateUsersDailySalesReport overwrites employeesDailySalesReport with only the passed employeeIds.
7. **Date range:** Use start-of-day and end-of-day when filtering by startDate/endDate; validate startDate ≤ endDate.
8. **Cascade:** Daily reports are deleted only as part of business cascade; avoid ad-hoc DELETE in normal flows.
9. **Populate:** Consistently populate employeesDailySalesReport.employeeId (employeeName) and selfOrderingSalesReport.customerId (customerName) on GET for UI.

---

## 10. Data model summary (for context)

- **DailySalesReport:** businessId, dailyReferenceNumber (unique), isDailyReportOpen, timeCountdownToClose, employeesDailySalesReport[], selfOrderingSalesReport[], and (after calculate) businessPaymentMethods, dailyTotalSalesBeforeAdjustments, dailyNetPaidAmount, dailyTipsReceived, dailyCostOfGoodsSold, dailyProfit, dailyCustomersServed, dailyAverageCustomerExpenditure, dailySoldGoods, dailyVoidedGoods, dailyInvitedGoods, dailyTotalVoidValue, dailyTotalInvitedValue, dailyPosSystemCommission.
- **employeesDailySalesReport[]:** Each entry: employeeId, hasOpenSalesInstances, employeePaymentMethods[], totalSalesBeforeAdjustments, totalNetPaidAmount, totalTipsReceived, totalCostOfGoodsSold, totalCustomersServed, averageCustomerExpenditure, soldGoods, voidedGoods, invitedGoods (IGoodsReduced[]), totalVoidValue, totalInvitedValue.
- **IGoodsReduced:** businessGoodId, quantity, totalPrice, totalCostPrice.
- **selfOrderingSalesReport[]:** customerId, customerPaymentMethods, totalSalesBeforeAdjustments, totalNetPaidAmount, totalCostOfGoodsSold, soldGoods.

This README is the main context for how the daily sales reports API and utils work, how they fit into the app (sales instances, orders, business, employees, self-ordering), and how to extend or integrate with them consistently.
