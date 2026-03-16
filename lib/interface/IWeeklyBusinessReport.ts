import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";
import { IGoodsReduced } from "./IDailySalesReport";

export interface IWeeklyFinancialPercentages {
  salesPaymentCompletionPercentage: number;
  profitMarginPercentage: number;
  voidSalesPercentage: number;
  invitedSalesPercentage: number;
  tipsToCostOfGoodsPercentage: number;
}

export interface IWeeklyFinancialSummary {
  totalSalesForWeek: number;
  totalCostOfGoodsSold: number;
  totalNetRevenue: number;
  totalGrossProfit: number;
  totalVoidSales: number;
  totalInvitedSales: number;
  totalTips: number;
  financialPercentages: IWeeklyFinancialPercentages;
}

export interface IWeeklyCostPercentages {
  foodCostRatio: number;
  beverageCostRatio: number;
  laborCostRatio: number;
}

export interface IWeeklyCostBreakdown {
  totalFoodCost: number;
  totalBeverageCost: number;
  totalLaborCost: number;
  totalOperatingCost: number;
  costPercentages: IWeeklyCostPercentages;
}

export interface IWeeklySupplierWasteAnalysis {
  veryLowImpactWastePercentage: number;
  lowImpactWastePercentage: number;
  mediumImpactWastePercentage: number;
  highImpactWastePercentage: number;
  veryHighImpactWastePercentage: number;
}

export interface IWeeklyMetricComparisonEntry {
  targetValue: number;
  actualValue: number;
  delta: number;
  isOverTarget: boolean;
  isUnderTarget: boolean;
}

export interface IWeeklyMetricsComparison {
  foodCostPercentage?: IWeeklyMetricComparisonEntry;
  laborCostPercentage?: IWeeklyMetricComparisonEntry;
  supplierGoodWastePercentage?: {
    veryLowBudgetImpact?: IWeeklyMetricComparisonEntry;
    lowBudgetImpact?: IWeeklyMetricComparisonEntry;
    mediumBudgetImpact?: IWeeklyMetricComparisonEntry;
    hightBudgetImpact?: IWeeklyMetricComparisonEntry;
    veryHightBudgetImpact?: IWeeklyMetricComparisonEntry;
  };
}

export interface IWeeklyBusinessReport {
  isReportOpen: boolean;
  businessId: Types.ObjectId;
  weekReference: Date;
  financialSummary: IWeeklyFinancialSummary;
  costBreakdown: IWeeklyCostBreakdown;
  goodsSold: IGoodsReduced[];
  goodsVoided: IGoodsReduced[];
  goodsComplimentary: IGoodsReduced[];
  supplierWasteAnalysis: IWeeklySupplierWasteAnalysis;
  metricsComparison?: IWeeklyMetricsComparison;
  totalCustomersServed: number;
  averageSpendingPerCustomer: number;
  paymentMethods: IPaymentMethod[];
  posSystemCommission: number;
}

