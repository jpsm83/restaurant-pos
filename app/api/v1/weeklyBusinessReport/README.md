# Weekly Business Report API — `app/api/v1/weeklyBusinessReport`

This folder contains the **REST API and logic for the Weekly Business Report entity**: one **week‑level** report per business that aggregates sales, variable costs, waste, and KPIs for a configurable reporting week.

- Weeks are defined per business using `Business.reportingConfig.weeklyReportStartDay` (0 = Sunday, 1 = Monday (default), …, 6 = Saturday).
- Weekly reports sit between **Daily sales reports** and the **Monthly business report**, focusing on **operational performance only** (no fixed/extra costs).
- Target‑vs‑actual comparisons are persisted on the report (`metricsComparison`) using `Business.metrics` as targets.

---

## 1. Purpose and role in the application

- **WeeklyBusinessReport** = one document per **reporting week** per business. It holds:
  - `businessId`, `weekReference` (date at start of week), `isReportOpen` (auto‑closed when the next week starts).
  - `financialSummary`: totalSalesForWeek, totalCostOfGoodsSold, totalNetRevenue, totalGrossProfit, totalVoidSales, totalInvitedSales, totalTips, plus `financialPercentages` (salesPaymentCompletionPercentage, profitMarginPercentage, voidSalesPercentage, invitedSalesPercentage, tipsToCostOfGoodsPercentage).
  - `costBreakdown`: totalFoodCost, totalBeverageCost, totalLaborCost, totalOperatingCost, and `costPercentages` (foodCostRatio, beverageCostRatio, laborCostRatio). **Weekly reports intentionally omit fixed/extra operating costs.**
  - `goodsSold`, `goodsVoided`, `goodsComplimentary`: merged from daily goods arrays.
  - `supplierWasteAnalysis`: waste percentages by supplier‑good budget impact (veryLow/low/medium/high/veryHigh), derived via `getWasteByBudgetImpactForMonth` scoped to the week.
  - `totalCustomersServed`, `averageSpendingPerCustomer`, `paymentMethods`, `posSystemCommission`.
  - `metricsComparison`: persisted **target‑vs‑actual** comparison for food and labour cost percentages and supplier waste by budget impact, using `Business.metrics` as targets.
- Weekly reports give managers a **short feedback loop** on whether the week is on target operationally, without mixing in monthly fixed/extra bills.

---

## 2. File structure

Current structure:

```text
app/api/v1/weeklyBusinessReport/
├── README.md                               # This file — flow, boundaries, and patterns
├── route.ts                                # GET all weekly reports (?businessId=&startWeek=&endWeek= YYYY-MM-DD)
├── business/
│   └── [businessId]/
│       └── route.ts                        # GET weekly reports for a business (?startWeek=&endWeek=)
├── [weeklyReportId]/
│   └── route.ts                            # GET one weekly report by ID
└── utils/
    ├── createWeeklyBusinessReport.ts       # getWeekReference + find-or-create open report for a week (in session)
    └── aggregateDailyReportsIntoWeekly.ts  # aggregate closed/calculated daily reports + Schedules labour into a week
```

- **Model and interface** live in **lib**:
  - `lib/db/models/weeklyBusinessReport.ts`
  - `lib/interface/IWeeklyBusinessReport.ts`
- Weekly reports are created **internally only** — there is no public POST.

---

## 3. Lifecycle and aggregation rules

### 3.1 Week boundaries and creation

- Week boundaries come from `getWeekReference(date, weeklyReportStartDay)`:
  - `weeklyReportStartDay` is read from `Business.reportingConfig.weeklyReportStartDay` (default 1 = Monday).
  - `weekReference` is always the **start‑of‑week date at 00:00:00**.
- `createWeeklyBusinessReport(businessId, weekReference, session)`:
  - If a report exists for `(businessId, weekReference)`, returns it.
  - Otherwise creates a new report with `isReportOpen: true` inside the caller’s transaction session.

### 3.2 Trigger from daily report creation

- In `app/api/v1/dailySalesReports/utils/createDailySalesReport.ts`:
  - When the first sales instance of a day is opened, the system:
    - Loads `Business.reportingConfig.weeklyReportStartDay` (default Monday).
    - Computes `currentWeekReference` from the current date and start day.
    - Computes `previousWeekReference` as the prior week.
    - If there is an **open weekly report** for the previous week:
      - Calls `aggregateDailyReportsIntoWeekly(businessId, previousWeekReference, weeklyReportStartDay)`.
      - Marks that weekly report `isReportOpen: false`.
      - Calls `sendWeeklyReportReadyNotification(businessId, weekLabel)` to notify on‑duty managers that the report is ready.
  - Errors in weekly aggregation or notification are **logged but do not block** daily report creation.

### 3.3 Aggregation logic

- `aggregateDailyReportsIntoWeekly(businessId, anyDateInWeek, weeklyReportStartDay)`:
  - Derives `weekReference` from `anyDateInWeek` + `weeklyReportStartDay` using `getWeekReference`.
  - Uses a MongoDB session and `createWeeklyBusinessReport` to get the open weekly report document.
  - Computes `weekStart` from `weekReference` and `weekEnd = weekStart + 6 days (23:59:59.999)`.
  - Queries **daily reports**:
    - `DailySalesReport.find({ businessId, createdAt: { $gte: weekStart, $lte: weekEnd }, dailyNetPaidAmount: { $exists: true, $ne: null } })`
    - Merges totals and goods similarly to monthly aggregation (sales, net revenue, COGS, tips, void/invited, customers served, POS commission, payment methods, goods sold/voided/complimentary).
  - Queries **Schedules** in `[weekStart, weekEnd]` and sums `totalDayEmployeesCost` as **labour cost**.
  - Calls `getWasteByBudgetImpactForMonth(businessId, weekStart)` and stores the resulting `supplierWasteAnalysis`.
  - Computes:
    - `totalOperatingCost = totalFoodCost + totalBeverageCost + totalLaborCost`
    - `foodCostRatio`, `beverageCostRatio`, `laborCostRatio`
    - `profitMarginPercentage`, `voidSalesPercentage`, `invitedSalesPercentage`, `salesPaymentCompletionPercentage`, `tipsToCostOfGoodsPercentage`
    - `averageSpendingPerCustomer`
  - **Fixed and extra costs are never included** in weekly aggregation.
  - Reads `Business.metrics` and builds `metricsComparison`:
    - `foodCostPercentage` and `laborCostPercentage`: compares the weekly ratios (×100) against targets.
    - `supplierGoodWastePercentage`: compares each waste band (veryLow/low/medium/high/veryHigh) from `supplierWasteAnalysis` to `Business.metrics.supplierGoodWastePercentage`.
  - Updates the weekly report document with all derived fields in **one `updateOne` call inside the transaction**.
  - The function is **idempotent**: each call recomputes the full week from source daily reports and schedules.

### 3.4 Close semantics

- Weekly reports **auto‑close**:
  - A week stays open (`isReportOpen: true`) while current days still belong to it.
  - When the first daily report of the **next** reporting week is created, the previous week is **aggregated and then marked closed**.
- There is **no manual PATCH route** to close or reopen weekly reports.

---

## 4. Routes

### 4.1 Index and business routes

- `GET /api/v1/weeklyBusinessReport`
  - Optional query params:
    - `businessId` — filter by business.
    - `startWeek`, `endWeek` — ISO dates (`YYYY-MM-DD`) interpreted as week start days.
  - Validates ObjectIds and date ranges.
  - Filters by `weekReference` range `[startWeek, endWeek + 6 days]`.
  - Returns reports sorted by `weekReference` (descending) or `404` if none.

- `GET /api/v1/weeklyBusinessReport/business/:businessId`
  - Same query parameters for `startWeek`/`endWeek`.
  - Validates `businessId` and week range.
  - Returns all matching reports for the business or `404` if none.

### 4.2 Single report route

- `GET /api/v1/weeklyBusinessReport/:weeklyReportId`
  - Validates `weeklyReportId`.
  - Returns the weekly report document or `404` if not found.
  - Weekly reports are **recalculated internally** via `aggregateDailyReportsIntoWeekly`; there is no public PATCH.

---

## 5. Notifications

- Weekly report completion triggers manager notifications via:
  - `lib/weeklyReports/sendWeeklyReportReadyNotification.ts`
  - This helper:
    - Finds **on‑duty employees** for the business whose `currentShiftRole` is in `MANAGEMENT_ROLES`.
    - Creates a `Notification` with type `"Info"` and message `"Weekly business report for {weekLabel} is ready."`.
    - Pushes `{ notificationId }` into each recipient’s `notifications` array.
    - Is **fire‑and‑forget** (does not throw; failures do not break the daily flow).

This README is the main context for how weekly business reports are defined, how they aggregate from daily reports and schedules, how they compare to `Business.metrics`, and how they trigger notifications to managers.

