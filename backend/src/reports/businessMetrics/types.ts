export interface FinancialPercentagesInput {
  totalSales: number;
  totalNetRevenue: number;
  totalGrossProfit: number;
  totalVoidSales: number;
  totalInvitedSales: number;
  totalTips: number;
  totalCostOfGoodsSold: number;
}

export interface FinancialPercentagesOutput {
  salesPaymentCompletionPercentage: number;
  profitMarginPercentage: number;
  voidSalesPercentage: number;
  invitedSalesPercentage: number;
  tipsToCostOfGoodsPercentage: number;
}

export interface CostRatiosByOperatingCostInput {
  totalFoodCost: number;
  totalBeverageCost: number;
  totalLaborCost: number;
  totalFixedOperatingCost?: number;
}

export interface CostRatiosByOperatingCostOutput {
  foodCostRatio: number;
  beverageCostRatio: number;
  laborCostRatio: number;
  fixedCostRatio?: number;
}

export interface CostRatiosByTotalSalesInput {
  totalSales: number;
  totalFoodCost: number;
  totalBeverageCost: number;
  totalLaborCost: number;
  totalFixedOperatingCost?: number;
}

export interface CostRatiosByTotalSalesOutput {
  foodCostRatio: number;
  beverageCostRatio: number;
  laborCostRatio: number;
  fixedCostRatio?: number;
}
