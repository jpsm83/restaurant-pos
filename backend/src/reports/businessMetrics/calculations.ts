import type {
  CostRatiosByOperatingCostInput,
  CostRatiosByOperatingCostOutput,
  CostRatiosByTotalSalesInput,
  CostRatiosByTotalSalesOutput,
  FinancialPercentagesInput,
  FinancialPercentagesOutput,
} from "./types.ts";

export const safeDivide = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

export const toPercentage = (ratio: number): number => ratio * 100;

export const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const roundPercentage = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const grossProfit = (netRevenue: number, cogs: number): number =>
  netRevenue - cogs;

export const grossProfitMarginPct = (
  totalSales: number,
  grossProfitValue: number,
): number => toPercentage(safeDivide(grossProfitValue, totalSales));

export const netProfit = (
  netRevenue: number,
  totalOperatingCost: number,
): number => netRevenue - totalOperatingCost;

export const netProfitMarginPct = (
  totalSales: number,
  netProfitValue: number,
): number => toPercentage(safeDivide(netProfitValue, totalSales));

export const foodCostPctOfSales = (
  foodCost: number,
  totalSales: number,
): number => toPercentage(safeDivide(foodCost, totalSales));

export const laborCostPctOfSales = (
  laborCost: number,
  totalSales: number,
): number => toPercentage(safeDivide(laborCost, totalSales));

export const primeCost = (foodCost: number, laborCost: number): number =>
  foodCost + laborCost;

export const primeCostPctOfSales = (
  foodCost: number,
  laborCost: number,
  totalSales: number,
): number => toPercentage(safeDivide(primeCost(foodCost, laborCost), totalSales));

export const fixedCostPctOfSales = (
  fixedCost: number,
  totalSales: number,
): number => toPercentage(safeDivide(fixedCost, totalSales));

export const salesPaymentCompletionPct = (
  totalSales: number,
  totalNetRevenue: number,
): number => toPercentage(safeDivide(totalNetRevenue, totalSales));

export const voidSalesPct = (
  totalSales: number,
  totalVoidSales: number,
): number => toPercentage(safeDivide(totalVoidSales, totalSales));

export const invitedSalesPct = (
  totalSales: number,
  totalInvitedSales: number,
): number => toPercentage(safeDivide(totalInvitedSales, totalSales));

export const tipsToCostOfGoodsPct = (
  totalTips: number,
  totalCostOfGoodsSold: number,
): number => toPercentage(safeDivide(totalTips, totalCostOfGoodsSold));

export const avgSpendPerCustomer = (
  totalNetRevenue: number,
  customersServed: number,
): number => safeDivide(totalNetRevenue, customersServed);

export const salesPerLaborHour = (
  totalSales: number,
  laborHours: number,
): number => safeDivide(totalSales, laborHours);

export const inventoryTurnover = (
  cogs: number,
  averageInventoryValue: number,
): number => safeDivide(cogs, averageInventoryValue);

export const tableTurnoverRate = (
  guestsServed: number,
  numberOfTables: number,
  serviceHours: number,
): number => safeDivide(safeDivide(guestsServed, numberOfTables), serviceHours);

export const foodWastePct = (
  foodWasteValue: number,
  foodPurchasedValue: number,
): number => toPercentage(safeDivide(foodWasteValue, foodPurchasedValue));

export const beverageWastePct = (
  beverageWasteValue: number,
  beveragePurchasedValue: number,
): number => toPercentage(safeDivide(beverageWasteValue, beveragePurchasedValue));

export const contributionMarginRatio = (
  totalSales: number,
  variableCosts: number,
): number => safeDivide(totalSales - variableCosts, totalSales);

// Break-even uses contribution-margin ratio (not gross margin) because fixed costs
// are covered by each additional sales dollar only after variable costs are paid.
export const breakEvenSales = (
  fixedCosts: number,
  contributionMarginRatioValue: number,
): number => safeDivide(fixedCosts, contributionMarginRatioValue);

// Daily target intentionally divides by period length to convert a monthly/weekly
// break-even goal into an operational per-day planning number.
export const minimumDailySalesTarget = (
  breakEvenSalesValue: number,
  daysInPeriod: number,
): number => safeDivide(breakEvenSalesValue, daysInPeriod);

export const promoSalesMixPct = (
  promoSales: number,
  totalSales: number,
): number => toPercentage(safeDivide(promoSales, totalSales));

export const promoDiscountRatePct = (
  promoDiscountValue: number,
  grossSales: number,
): number => toPercentage(safeDivide(promoDiscountValue, grossSales));

export const beverageCostPctOfBeverageSales = (
  beverageCogs: number,
  beverageSales: number,
): number => toPercentage(safeDivide(beverageCogs, beverageSales));

export const foodContributionMargin = (
  foodSales: number,
  foodCogs: number,
): number => foodSales - foodCogs;

export const beverageContributionMargin = (
  beverageSales: number,
  beverageCogs: number,
): number => beverageSales - beverageCogs;

export const foodContributionMarginPct = (
  foodSales: number,
  foodCogs: number,
): number => toPercentage(safeDivide(foodContributionMargin(foodSales, foodCogs), foodSales));

export const beverageContributionMarginPct = (
  beverageSales: number,
  beverageCogs: number,
): number =>
  toPercentage(
    safeDivide(
      beverageContributionMargin(beverageSales, beverageCogs),
      beverageSales,
    ),
  );

export const barLaborCostPctOfBeverageSales = (
  barLaborCost: number,
  beverageSales: number,
): number => toPercentage(safeDivide(barLaborCost, beverageSales));

export const kitchenLaborCostPctOfFoodSales = (
  kitchenLaborCost: number,
  foodSales: number,
): number => toPercentage(safeDivide(kitchenLaborCost, foodSales));

export const categorySalesMixPct = (
  categorySales: number,
  totalSales: number,
): number => toPercentage(safeDivide(categorySales, totalSales));

export const daypartSalesMixPct = (
  daypartSales: number,
  totalSales: number,
): number => toPercentage(safeDivide(daypartSales, totalSales));

export const daypartGrossProfit = (
  daypartNetRevenue: number,
  daypartCogs: number,
): number => daypartNetRevenue - daypartCogs;

export const daypartGrossProfitMarginPct = (
  daypartSales: number,
  daypartGrossProfitValue: number,
): number => toPercentage(safeDivide(daypartGrossProfitValue, daypartSales));

export const daypartLaborPct = (
  daypartLaborCost: number,
  daypartSales: number,
): number => toPercentage(safeDivide(daypartLaborCost, daypartSales));

// Proxy ROI denominator is discount value to show sales lift per discount dollar.
export const promoRoiProxy = (
  incrementalPromoSales: number,
  promoDiscountValue: number,
): number => safeDivide(incrementalPromoSales, promoDiscountValue);

export const promoNetMarginLift = (
  promoGrossProfit: number,
  baselineGrossProfit: number,
): number => promoGrossProfit - baselineGrossProfit;

export const promoOrderSharePct = (
  promoOrders: number,
  totalOrders: number,
): number => toPercentage(safeDivide(promoOrders, totalOrders));

export const pourCostPct = (
  beverageUsedCost: number,
  beverageSales: number,
): number => toPercentage(safeDivide(beverageUsedCost, beverageSales));

export const beverageVariancePct = (
  actualBeverageUsageCost: number,
  theoreticalBeverageUsageCost: number,
): number =>
  // Theoretical usage is the baseline expectation from recipes/standards.
  toPercentage(
    safeDivide(
      actualBeverageUsageCost - theoreticalBeverageUsageCost,
      theoreticalBeverageUsageCost,
    ),
  );

export const revenuePerSeatHour = (
  totalSales: number,
  availableSeatHours: number,
): number => safeDivide(totalSales, availableSeatHours);

export const revenuePerTableHour = (
  totalSales: number,
  availableTableHours: number,
): number => safeDivide(totalSales, availableTableHours);

// Grouped exports keep calculator usage explicit by business domain.
export const profitability = {
  grossProfit,
  grossProfitMarginPct,
  netProfit,
  netProfitMarginPct,
};

export const costs = {
  foodCostPctOfSales,
  laborCostPctOfSales,
  primeCost,
  primeCostPctOfSales,
  fixedCostPctOfSales,
  tipsToCostOfGoodsPct,
};

export const salesQuality = {
  salesPaymentCompletionPct,
  voidSalesPct,
  invitedSalesPct,
};

export const operations = {
  avgSpendPerCustomer,
  salesPerLaborHour,
  inventoryTurnover,
  tableTurnoverRate,
  foodWastePct,
  beverageWastePct,
};

export const targets = {
  contributionMarginRatio,
  breakEvenSales,
  minimumDailySalesTarget,
};

export const promotions = {
  promoSalesMixPct,
  promoDiscountRatePct,
};

export const categoryMix = {
  categorySalesMixPct,
  beverageCostPctOfBeverageSales,
};

export const daypart = {
  daypartSalesMixPct,
  daypartGrossProfit,
  daypartGrossProfitMarginPct,
  daypartLaborPct,
};

export const barControls = {
  pourCostPct,
  beverageVariancePct,
  revenuePerSeatHour,
  revenuePerTableHour,
};

export const promoEffectiveness = {
  promoRoiProxy,
  promoNetMarginLift,
  promoOrderSharePct,
};

export const calculateFinancialPercentages = (
  input: FinancialPercentagesInput,
): FinancialPercentagesOutput => ({
  salesPaymentCompletionPercentage: salesPaymentCompletionPct(
    input.totalSales,
    input.totalNetRevenue,
  ),
  profitMarginPercentage: grossProfitMarginPct(
    input.totalSales,
    input.totalGrossProfit,
  ),
  voidSalesPercentage: voidSalesPct(input.totalSales, input.totalVoidSales),
  invitedSalesPercentage: invitedSalesPct(
    input.totalSales,
    input.totalInvitedSales,
  ),
  tipsToCostOfGoodsPercentage: tipsToCostOfGoodsPct(
    input.totalTips,
    input.totalCostOfGoodsSold,
  ),
});

/**
 * Uses operating-cost denominator to keep current weekly/monthly report behavior.
 * Canonical sales-denominator cost KPIs are available in dedicated helpers above.
 */
export const calculateCostRatiosByOperatingCost = (
  input: CostRatiosByOperatingCostInput,
): CostRatiosByOperatingCostOutput => {
  const totalOperatingCost =
    input.totalFoodCost +
    input.totalBeverageCost +
    input.totalLaborCost +
    (input.totalFixedOperatingCost ?? 0);

  const base: CostRatiosByOperatingCostOutput = {
    foodCostRatio: safeDivide(input.totalFoodCost, totalOperatingCost),
    beverageCostRatio: safeDivide(input.totalBeverageCost, totalOperatingCost),
    laborCostRatio: safeDivide(input.totalLaborCost, totalOperatingCost),
  };

  if (typeof input.totalFixedOperatingCost === "number") {
    base.fixedCostRatio = safeDivide(
      input.totalFixedOperatingCost,
      totalOperatingCost,
    );
  }

  return base;
};

/**
 * Cost ratios against total sales.
 * This is the KPI denominator expected by weekly/monthly business views.
 */
export const calculateCostRatiosByTotalSales = (
  input: CostRatiosByTotalSalesInput,
): CostRatiosByTotalSalesOutput => {
  const base: CostRatiosByTotalSalesOutput = {
    foodCostRatio: safeDivide(input.totalFoodCost, input.totalSales),
    beverageCostRatio: safeDivide(input.totalBeverageCost, input.totalSales),
    laborCostRatio: safeDivide(input.totalLaborCost, input.totalSales),
  };

  if (typeof input.totalFixedOperatingCost === "number") {
    base.fixedCostRatio = safeDivide(
      input.totalFixedOperatingCost,
      input.totalSales,
    );
  }

  return base;
};
