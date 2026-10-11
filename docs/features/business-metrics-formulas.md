# Business Metrics Formula Reference

This is the canonical formula guide for weekly and monthly restaurant metrics.
Implementation source of truth: `backend/src/reports/businessMetrics/calculations.ts`.

## Core conventions

- Percent KPIs are returned as `0..100` (already multiplied by 100).
- Division is guarded by `safeDivide(numerator, denominator)` and returns `0` when denominator is `0`.
- Weekly and monthly aggregators use the same helper formulas to keep semantics aligned.

## Profitability

- `grossProfit = netRevenue - cogs`
- `grossProfitMarginPct = (grossProfit / totalSales) * 100`
- `netProfit = netRevenue - totalOperatingCost`
- `netProfitMarginPct = (netProfit / totalSales) * 100`

Example:
- Inputs: `totalSales=150`, `netRevenue=135`, `cogs=60`, `totalOperatingCost=130`
- Results:
  - `grossProfit = 75`
  - `grossProfitMarginPct = 50`
  - `netProfit = 5`
  - `netProfitMarginPct = 3.33`

## Cost and sales quality

- `foodCostPctOfSales = (foodCost / totalSales) * 100`
- `laborCostPctOfSales = (laborCost / totalSales) * 100`
- `primeCost = foodCost + laborCost`
- `primeCostPctOfSales = (primeCost / totalSales) * 100`
- `salesPaymentCompletionPct = (totalNetRevenue / totalSales) * 100`
- `voidSalesPct = (totalVoidSales / totalSales) * 100`
- `invitedSalesPct = (totalInvitedSales / totalSales) * 100`

Example:
- Inputs: `totalSales=500`, `foodCost=150`, `laborCost=100`, `totalNetRevenue=450`, `totalVoidSales=20`
- Results:
  - `foodCostPctOfSales = 30`
  - `primeCost = 250`
  - `primeCostPctOfSales = 50`
  - `salesPaymentCompletionPct = 90`
  - `voidSalesPct = 4`

## Break-even and targets

- `contributionMarginRatio = (totalSales - variableCosts) / totalSales`
- `breakEvenSales = fixedCosts / contributionMarginRatio`
- `minimumDailySalesTarget = breakEvenSales / daysInPeriod`

Example:
- Inputs: `totalSales=150`, `variableCosts=90`, `fixedCosts=40`, `daysInPeriod=30`
- Results:
  - `contributionMarginRatio = 0.4`
  - `breakEvenSales = 100`
  - `minimumDailySalesTarget = 3.33`

## Operational efficiency

- `avgSpendPerCustomer = totalNetRevenue / customersServed`
- `salesPerLaborHour = totalSales / laborHours`
- `inventoryTurnover = cogs / averageInventoryValue`
- `tableTurnoverRate = (guestsServed / numberOfTables) / serviceHours`

## Promotion and bar controls (V2)

- `promoSalesMixPct = (promoSales / totalSales) * 100`
- `promoDiscountRatePct = (promoDiscountValue / grossSales) * 100`
- `promoRoiProxy = incrementalPromoSales / promoDiscountValue`
- `pourCostPct = (beverageUsedCost / beverageSales) * 100`
- `beverageVariancePct = ((actualUsage - theoreticalUsage) / theoreticalUsage) * 100`

Interpretation notes:
- Higher `promoRoiProxy` means more sales lift per discount dollar.
- Positive `beverageVariancePct` means actual usage cost is above theoretical expectation (possible waste/over-pouring).
