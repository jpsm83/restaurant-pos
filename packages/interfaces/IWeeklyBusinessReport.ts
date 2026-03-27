import { Types } from "mongoose";
import { IGoodsReduced } from "./IDailySalesReport.ts";
import { IPaymentMethod } from "./IPaymentMethod.ts";

export type WeekLabel = string;

/**
 * Lean/open-report info returned by `createWeeklyBusinessReport()`.
 * Used internally by weekly aggregation flows.
 */
export type WeeklyReportOpen = {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  weekReference: Date;
  isReportOpen: boolean;
};

/**
 * Raw metrics stored on the Business document (targets used for comparisons).
 * `aggregateDailyReportsIntoWeekly` consumes this shape.
 */
export interface IMetrics {
  foodCostPercentage: number;
  laborCostPercentage: number;
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: number;
    lowBudgetImpact: number;
    mediumBudgetImpact: number;
    hightBudgetImpact: number;
    veryHightBudgetImpact: number;
  };
}

export interface IWeeklyFinancialPercentages {
  salesPaymentCompletionPercentage: number; // Paid share of gross sales during the week
  profitMarginPercentage: number; // Gross profit margin for the week
  voidSalesPercentage: number; // Voided share of weekly sales
  invitedSalesPercentage: number; // Complimentary share of weekly sales
  tipsToCostOfGoodsPercentage: number; // Tips relative to cost of goods sold
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

