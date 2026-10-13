# Business metrics formulas

Canonical formulas for weekly and monthly restaurant metrics. The weekly and monthly aggregators share these helpers so their semantics stay aligned; the implementation lives in the backend business-metrics calculations.

## Core conventions

- Percent KPIs are returned as `0..100` (already multiplied by 100).
- Division is guarded so a `0` denominator yields `0`.

## Profitability

- `grossProfit = netRevenue - cogs`
- `grossProfitMarginPct = (grossProfit / totalSales) * 100`
- `netProfit = netRevenue - totalOperatingCost`
- `netProfitMarginPct = (netProfit / totalSales) * 100`

## Cost and sales quality

- `foodCostPctOfSales = (foodCost / totalSales) * 100`
- `laborCostPctOfSales = (laborCost / totalSales) * 100`
- `primeCost = foodCost + laborCost`
- `primeCostPctOfSales = (primeCost / totalSales) * 100`
- `salesPaymentCompletionPct = (totalNetRevenue / totalSales) * 100`
- `voidSalesPct = (totalVoidSales / totalSales) * 100`
- `invitedSalesPct = (totalInvitedSales / totalSales) * 100`

## Break-even and targets

- `contributionMarginRatio = (totalSales - variableCosts) / totalSales`
- `breakEvenSales = fixedCosts / contributionMarginRatio`
- `minimumDailySalesTarget = breakEvenSales / daysInPeriod`

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

## Interpretation

- Higher `promoRoiProxy` means more sales lift per discount dollar.
- Positive `beverageVariancePct` means actual usage cost is above theoretical expectation (possible waste or over-pouring).
