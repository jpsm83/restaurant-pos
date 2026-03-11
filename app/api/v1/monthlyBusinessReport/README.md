# Monthly Business Report API — `app/api/v1/monthlyBusinessReport`

This folder is intended to contain the **REST API and logic for the Monthly Business Report entity**: one **month-level** report per business that aggregates sales, costs (food, beverage, labor, fixed, extra), supplier waste by budget impact, payment methods, and POS commission. The monthly report is the **business-level analytics layer** that sits above **Daily Sales Reports**: it is updated (e.g. daily) from closed daily reports and other sources (purchases, schedules, fixed costs) and **closes at the end of the month**, similar to **Inventory**. It ties **Business** (metrics and targets), **Daily Sales Reports**, **Orders**, **Purchases**, **Schedules** (labor), **Inventories** (waste), and **Supplier goods** (waste by budget impact) into a single view for profitability, break-even, and KPI tracking.

**Current state:** The **model** and **interface** include `monthReference` (first day of month) and live in `lib/db/models/monthlyBusinessReport.ts` and `lib/interface/IMonthlyBusinessReport.ts`. **Business DELETE** cascades to `MonthlyBusinessReport.deleteMany({ businessId })`. The **API and aggregation are implemented**: root and business routes (GET), get/update by report ID, close-monthly-report (PATCH), and utils `createMonthlyBusinessReport` and `aggregateDailyReportsIntoMonthly`. The monthly report is **refreshed automatically** after each **calculateBusinessDailySalesReport** (daily trigger). **toDo.md** remains for additional formulas and future metrics.

This document follows the same structure as `app/api/v1/business/README.md` for consistency.

---

## 1. Purpose and role in the application

- **Monthly Business Report** = one document per **calendar month** per business. It holds:
  - **isReportOpen**: whether the month is still open for updates (true until closed, e.g. on the last day of the month).
  - **financialSummary**: totalSalesForMonth, totalCostOfGoodsSold, totalNetRevenue, totalGrossProfit, totalVoidSales, totalInvitedSales, totalTips, and **financialPercentages** (salesPaymentCompletionPercentage, profitMarginPercentage, voidSalesPercentage, invitedSalesPercentage, tipsToCostOfGoodsPercentage).
  - **costBreakdown**: totalFoodCost, totalBeverageCost, totalLaborCost, totalFixedOperatingCost, totalExtraCost, totalOperatingCost, and **costPercentages** (foodCostRatio, beverageCostRatio, laborCostRatio, fixedCostRatio).
  - **goodsSold**, **goodsVoided**, **goodsComplimentary**: arrays of goods (businessGoodId, quantity, totalPrice, totalCostPrice) — same structure as daily report’s dailySoldGoods / dailyVoidedGoods / dailyInvitedGoods.
  - **supplierWasteAnalysis**: waste percentages by **supplier good budget impact** (veryLowImpactWastePercentage, lowImpactWastePercentage, mediumImpactWastePercentage, highImpactWastePercentage, veryHighImpactWastePercentage). This links to **Business.metrics.supplierGoodWastePercentage** (targets per impact level) and to **Inventory** deviation/waste data.
  - **totalCustomersServed**, **averageSpendingPerCustomer**, **paymentMethods**, **posSystemCommission**.
- **Relationship to suppliers and business:** The report does not reference **Supplier** directly. It references **supplier good waste by budget impact** (SupplierGoods have budgetImpact; waste is tracked in inventory and can be rolled up here). **Purchases** feed into cost and COGS; **Business.metrics** define target percentages (food cost, labor cost, fixed cost, supplier good waste by impact). The monthly report is where **actual** performance is compared to those **targets** (e.g. food cost %, labor cost %, waste %).
- **Intended lifecycle (from toDo.md):** The report **updates daily** after the **daily sales report** is calculated (not real-time dynamic). It **closes** on the **last day of the month**, same logic as **Inventory** (new month = new report; previous month marked closed). This aligns with how the app already creates one inventory per month and one daily report per day.
- **Planned metrics (from toDo.md):** Break-even (daily sales target = sum of all costs / days in month), gross profit margin, net profit margin, minimum daily sales (break-even sales), food cost percentage, labor cost percentage, waste by category (food/beverage), inventory turnover, table turnover, sales per labor hour, promotion sales share. Many of these can be derived from the existing schema (financialSummary, costBreakdown, supplierWasteAnalysis) plus business metrics and schedules.

So: **Monthly Business Report is the month-level hub for business KPIs, costs, and supplier-related waste analytics. It is fed by daily reports and other cost sources and is important for understanding profitability, break-even, and how the business (and its supply chain) is performing against targets.**

---

## 2. File structure

**Current:**

```
app/api/v1/monthlyBusinessReport/
├── README.md                    # This file — context for flow, patterns, and app integration
├── toDo.md                      # Additional formulas and metrics (break-even, waste %, etc.)
├── route.ts                     # GET all monthly reports (optional ?businessId=&startMonth=&endMonth=)
├── business/
│   └── [businessId]/
│       └── route.ts             # GET monthly reports for business (?startMonth=&endMonth= YYYY-MM)
├── [monthlyReportId]/
│   ├── route.ts                 # GET one report; PATCH fixed/extra costs when isReportOpen
│   └── closeMonthlyReport/
│       └── route.ts             # PATCH — close report (body: employeeId), role check, no open daily reports in month
└── utils/
    ├── createMonthlyBusinessReport.ts   # Find or create open report for current month; close previous in transaction
    └── aggregateDailyReportsIntoMonthly.ts  # Aggregate calculated daily reports + Schedules labour; called after calculateBusinessDailySalesReport
```

- **Model and interface** live in **lib**: `lib/db/models/monthlyBusinessReport.ts` (includes `monthReference`), `lib/interface/IMonthlyBusinessReport.ts`.
- **Creation:** No public POST. The open report for the current month is created internally by `createMonthlyBusinessReport` when `aggregateDailyReportsIntoMonthly` runs (e.g. after the first daily calculate of the month).

---

## 3. Route reference

| Method | Path | Description |
|--------|------|--------------|
| GET | `/api/v1/monthlyBusinessReport` | Return monthly reports. Optional query: `?businessId=`, `?startMonth=YYYY-MM`, `?endMonth=YYYY-MM`. 404 if none. |
| GET | `/api/v1/monthlyBusinessReport/business/:businessId` | Return monthly reports for business. Optional `?startMonth=`, `?endMonth=` (YYYY-MM). 404 if none. |
| GET | `/api/v1/monthlyBusinessReport/:monthlyReportId` | Return one report by ID. 404 if not found. |
| PATCH | `/api/v1/monthlyBusinessReport/:monthlyReportId` | When isReportOpen: update totalFixedOperatingCost and/or totalExtraCost (manual entry). Recomputes totalOperatingCost and costPercentages. Returns updated report. Or separate PATCH for “recalculate from daily reports.” |
| PATCH | `/api/v1/monthlyBusinessReport/:monthlyReportId/closeMonthlyReport` | Set isReportOpen: false. Body: `{ employeeId }`. Same role check as daily report close. 400 if any daily report for that month is still open. |

- **Creation:** The open report for the current month is created internally by `createMonthlyBusinessReport` when `aggregateDailyReportsIntoMonthly(businessId)` runs (triggered after **calculateBusinessDailySalesReport**). No public POST.
- DELETE is not used in normal flow; reports are removed only when **Business** is deleted (cascade in `app/api/v1/business/[businessId]/route.ts`).

---

## 4. Request/response patterns

- **DB:** `connectDb()` before first query. Use `MonthlyBusinessReport.find()` or `findById()` with optional `.populate("businessId", "tradeName ...")` if needed.
- **Validation:** Validate `businessId`, `monthlyReportId` with `isObjectIdValid(...)`.
- **Date/month scope:** Filter by month (e.g. `createdAt` between first and last day of month, or a dedicated `monthReference` field if added). Same pattern as inventories: start/end of month for “current month” and “previous month.”
- **Creation:** Similar to **Inventory** POST: if report for **current month** already exists, return 400. Find **previous month** report and set `isReportOpen: false` (if applicable). Create new report with `isReportOpen: true` and initial/empty aggregates. Use a **transaction** when closing previous and creating new.
- **Update (recalculate from daily reports):** For the open monthly report, aggregate from **DailySalesReport** documents for that business and month (createdAt in range, or a stored month identifier). Sum daily totals (dailyNetPaidAmount, dailyCostOfGoodsSold, dailyTipsReceived, etc.), merge goods arrays (sold/void/invited), merge payment methods. Compute financialSummary and financialPercentages. Labor/fixed/extra costs may come from **Schedules**, manual entry, or future cost entities.
- **Close:** Ensure no open daily reports for that month (or define rule); set `isReportOpen: false`. Role check: e.g. Manager/Admin only.

---

## 5. How monthly business reports interact with the rest of the app

### 5.1 Business (tenant, metrics, cascade)

- Every monthly report has **businessId**. Reports are scoped by business.
- **Business.metrics** define **target** percentages: foodCostPercentage, laborCostPercentage, fixedCostPercentage, and **supplierGoodWastePercentage** (by budget impact: veryLowBudgetImpact, lowBudgetImpact, etc.). The monthly report’s **costBreakdown.costPercentages** and **supplierWasteAnalysis** hold **actual** values; comparison with Business.metrics drives KPI dashboards and alerts (e.g. food cost over target, waste over target).
- **Business DELETE** cascades: `MonthlyBusinessReport.deleteMany({ businessId }, { session })` runs inside the business DELETE transaction. No orphaned monthly reports.

### 5.2 Daily sales reports (main source of sales and COGS)

- **Daily Sales Reports** are calculated and optionally closed per day. They contain daily totals (dailyNetPaidAmount, dailyCostOfGoodsSold, dailyTipsReceived, dailySoldGoods, dailyVoidedGoods, dailyInvitedGoods, businessPaymentMethods, dailyPosSystemCommission). These totals are based on `orderNetPrice` and promotion/discount effects that have already been **validated on the backend** at order creation.
- The **monthly report** should **aggregate** these daily reports for the same business and month: sum totals, merge goods arrays by businessGoodId, merge payment methods. So: **daily reports (which themselves are fed by backend-validated orders) are the source of truth for day-level data; the monthly report is the rolled-up view.** Update can run after daily report is calculated (as in toDo: “updates daily after daily sales report is calculate (not dynamic)”).

### 5.3 Orders and sales instances

- Orders and sales instances are not read directly by the monthly report; they are already aggregated in **Daily Sales Reports**. So the flow is: Orders → Daily Sales Report (calculate) → Monthly Business Report (aggregate daily reports).

### 5.4 Purchases and cost breakdown

- **Purchases** represent incoming stock and **purchase costs**. For **costBreakdown**, totalFoodCost / totalBeverageCost can be derived from purchases (and/or from order cost of goods by category if BusinessGood has category). totalLaborCost can come from **Schedules** (labour cost) or a dedicated labour-cost entity. totalFixedOperatingCost (rent, utilities) and totalExtraCost might be manual entry or future “fixed cost” entities. totalOperatingCost = sum of these; costPercentages are ratios of each to totalOperatingCost.

### 5.5 Inventories and supplier waste

- **Inventory** holds **supplier good** usage and physical counts (dynamicSystemCount, deviation, monthlyCounts). **SupplierGood** has **budgetImpact** (e.g. very low, low, medium, high, very high). Waste can be inferred from inventory deviation or from dedicated waste logs. **supplierWasteAnalysis** in the monthly report should reflect **waste percentages by budget impact**, aligned with **Business.metrics.supplierGoodWastePercentage** targets. So the monthly report ties **supplier-side** performance (waste by impact level) to the business’s targets and to inventory data.

### 5.6 Schedules (labor cost)

- **Schedules** store shifts and labour cost per business. **totalLaborCost** for the month can be summed from schedules for that month (or from a derived labour-cost view). This feeds **costBreakdown** and **labor cost percentage** (labor / total sales), to be compared with Business.metrics.laborCostPercentage.

### 5.7 Summary flow (implemented)

- **Start of month (or first aggregation):** When `aggregateDailyReportsIntoMonthly(businessId)` runs, `createMonthlyBusinessReport` finds or creates the open report for the current month (isReportOpen: true) and closes the previous month’s report (isReportOpen: false) in the same transaction. Same pattern as Inventory.
- **After daily report is calculated:** The **calculateBusinessDailySalesReport** route calls `aggregateDailyReportsIntoMonthly(dailySalesReport.businessId)` after updating the daily report. Aggregation re-sums all **calculated** daily reports for that month (dailyNetPaidAmount present), merges payment methods and goods by businessGoodId, sums labour from Schedules, preserves manual fixed/extra costs, and sets supplierWasteAnalysis (Phase 1: zeroed). The PATCH response is not failed if aggregation throws (errors are logged).
- **End of month:** Manager calls PATCH **closeMonthlyReport** with employeeId. Validates no open daily reports in that month; sets isReportOpen: false. Final snapshot for reporting and comparison with Business.metrics.

---

## 6. Shared utilities and dependencies (intended)

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate businessId, monthlyReportId. |
| `@/lib/interface/IMonthlyBusinessReport`, IFinancialSummary, ICostBreakdown, ISupplierWasteAnalysis | Types for report and nested objects. |
| `@/lib/db/models/monthlyBusinessReport` | Mongoose model. |
| `@/lib/db/models/dailySalesReport` | goodsReducedSchema reused; source of daily aggregates. |
| `@/lib/db/models/business` | Business metrics (targets). |
| DailySalesReport (model) | Aggregate by businessId and month (createdAt or month ref). |
| Schedule (model) | Labor cost for month. |
| Inventory / SupplierGood | Waste by budget impact (if implemented). |

---

## 7. Patterns to follow when implementing

1. **Always call `connectDb()`** before the first MongoDB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for businessId and monthlyReportId.
3. **Month boundaries:** Use first and last day of month for “current month” and “previous month” (e.g. moment or Date). One open report per business per month.
4. **Creation:** When creating a new month report, run in a **transaction**: close previous month’s report (set isReportOpen: false), then create new report. Return 400 if current month report already exists.
5. **Aggregation:** When updating from daily reports, aggregate only **closed** or **calculated** daily reports for that month to avoid double-counting or partial data. Define clearly whether “update daily” runs on all daily reports for the month or only up to the latest calculated day.
6. **Supplier waste:** Keep **supplierWasteAnalysis** in sync with **Business.metrics.supplierGoodWastePercentage** structure (same budget impact levels) so UI can compare actual vs target.
7. **Cost breakdown:** Define where totalFixedOperatingCost and totalExtraCost come from (manual PATCH, future “costs” entity, or leave null until implemented).
8. **Cascade:** Do not implement DELETE for single report in normal flow; rely on business cascade delete.
9. **Role checks:** For close-monthly-report (and possibly create), restrict to Manager/Admin (or same roles as daily report close).

---

## 8. Data model summary (for context)

- **MonthlyBusinessReport:** businessId, **monthReference** (Date, first day of month at 00:00:00; required, indexed; unique with businessId), isReportOpen, financialSummary, costBreakdown, goodsSold, goodsVoided, goodsComplimentary, supplierWasteAnalysis, totalCustomersServed, averageSpendingPerCustomer, paymentMethods, posSystemCommission.
- **financialSummary:** totalSalesForMonth, totalCostOfGoodsSold, totalNetRevenue, totalGrossProfit, totalVoidSales, totalInvitedSales, totalTips; **financialPercentages:** salesPaymentCompletionPercentage, profitMarginPercentage, voidSalesPercentage, invitedSalesPercentage, tipsToCostOfGoodsPercentage.
- **costBreakdown:** totalFoodCost, totalBeverageCost, totalLaborCost, totalFixedOperatingCost, totalExtraCost, totalOperatingCost; **costPercentages:** foodCostRatio, beverageCostRatio, laborCostRatio, fixedCostRatio.
- **supplierWasteAnalysis:** veryLowImpactWastePercentage, lowImpactWastePercentage, mediumImpactWastePercentage, highImpactWastePercentage, veryHighImpactWastePercentage (align with SupplierGood budgetImpact and Business.metrics.supplierGoodWastePercentage).
- **goodsSold / goodsVoided / goodsComplimentary:** Same structure as daily report (businessGoodId, quantity, totalPrice, totalCostPrice) — from `goodsReducedSchema` in dailySalesReport model.

**toDo.md** in this folder contains additional formulas and metrics (break-even, daily sales target, food/labor cost %, waste %, inventory turnover, etc.) that can be computed from this schema plus Business.metrics and Schedules when implementing the API and any dashboard logic.

This README is the main context for how the monthly business report domain is designed, how it fits into the app (business, daily reports, orders, purchases, inventories, schedules, suppliers/supplier waste), and how to implement routes and utils consistently.
