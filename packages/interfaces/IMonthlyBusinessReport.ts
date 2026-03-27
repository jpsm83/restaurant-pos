import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";
import { IGoodsReduced } from "./IDailySalesReport";

export interface IFinancialPercentages {
  salesPaymentCompletionPercentage: number; // Percentage of sales paid during the month
  profitMarginPercentage: number; // Profit margin percentage
  netProfitMarginPercentage: number; // Net profit margin after operating costs
  voidSalesPercentage: number; // Percentage of void sales
  invitedSalesPercentage: number; // Percentage of invited sales
  tipsToCostOfGoodsPercentage: number; // Tips as a percentage of the total cost of goods sold
}

export interface IFinancialSummary {
  totalSalesForMonth: number; // Total sales for the month
  totalCostOfGoodsSold: number; // Total cost of goods sold
  totalNetRevenue: number; // Total net revenue
  totalGrossProfit: number; // Total gross profit
  totalNetProfit: number; // Total net profit after operating costs
  totalVoidSales: number; // Total void sales
  totalInvitedSales: number; // Total invited sales
  totalTips: number; // Total tips collected
  breakEvenSales: number; // Monthly break-even sales target
  minimumDailySalesTarget: number; // Daily sales target needed to hit monthly break-even
  financialPercentages: IFinancialPercentages; // Financial percentages
}

export interface ICostPercentages {
  foodCostRatio: number; // Food cost ratio
  beverageCostRatio: number; // Beverage cost ratio
  laborCostRatio: number; // Labor cost ratio
  fixedCostRatio: number; // Fixed cost ratio
}

export interface ICostBreakdown {
  totalFoodCost: number; // Total food cost
  totalBeverageCost: number; // Total beverage cost
  totalLaborCost: number; // Total labor cost
  totalFixedOperatingCost: number; // Total fixed operating cost
  totalExtraCost: number; // Total extra cost
  totalOperatingCost: number; // Total operating cost
  costPercentages: ICostPercentages; // Cost percentages
}

export interface ISupplierWasteAnalysis {
  veryLowImpactWastePercentage: number; // Percentage of very low impact waste
  lowImpactWastePercentage: number; // Percentage of low impact waste
  mediumImpactWastePercentage: number; // Percentage of medium impact waste
  highImpactWastePercentage: number; // Percentage of high impact waste
  veryHighImpactWastePercentage: number; // Percentage of very high impact waste
}

export interface IMetricComparisonEntry {
  targetValue: number; // Target value configured on Business.metrics
  actualValue: number; // Actual value observed in the report
  delta: number; // actualValue - targetValue (percentage points or same unit)
  isOverTarget: boolean; // True when actualValue > targetValue
  isUnderTarget: boolean; // True when actualValue < targetValue
}

export interface IMonthlyMetricsComparison {
  foodCostPercentage?: IMetricComparisonEntry;
  laborCostPercentage?: IMetricComparisonEntry;
  fixedCostPercentage?: IMetricComparisonEntry;
  supplierGoodWastePercentage?: {
    veryLowBudgetImpact?: IMetricComparisonEntry;
    lowBudgetImpact?: IMetricComparisonEntry;
    mediumBudgetImpact?: IMetricComparisonEntry;
    hightBudgetImpact?: IMetricComparisonEntry;
    veryHightBudgetImpact?: IMetricComparisonEntry;
  };
}

export interface IMonthlyBusinessReport {
  isReportOpen: boolean; // Indicates if the report is open for edits
  businessId: Types.ObjectId; // Business reference
  monthReference: Date; // First day of the month at 00:00:00 for scoping and matching daily reports
  financialSummary: IFinancialSummary; // Financial summary for the month
  costBreakdown: ICostBreakdown; // Breakdown of various costs
  goodsSold: IGoodsReduced[]; // Goods sold during the month
  goodsVoided: IGoodsReduced[]; // Voided goods during the month
  goodsComplimentary: IGoodsReduced[]; // Complimentary goods
  supplierWasteAnalysis: ISupplierWasteAnalysis; // Analysis of supplier waste percentages
  metricsComparison?: IMonthlyMetricsComparison; // Comparison between targets (Business.metrics) and actual report ratios
  totalCustomersServed: number; // Total number of customers served
  averageSpendingPerCustomer: number; // Average spending per customer
  paymentMethods: IPaymentMethod[]; // Array of payment methods used
  posSystemCommission: number; // POS system commission
}
