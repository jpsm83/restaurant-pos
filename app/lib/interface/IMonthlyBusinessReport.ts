import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";
import { goodsReducedSchema } from "../models/dailySalesReport";

export interface IFinancialPercentages {
  salesPaymentCompletionPercentage: number; // Percentage of sales paid during the month
  profitMarginPercentage: number; // Profit margin percentage
  voidSalesPercentage: number; // Percentage of void sales
  invitedSalesPercentage: number; // Percentage of invited sales
  tipsToCostOfGoodsPercentage: number; // Tips as a percentage of the total cost of goods sold
}

export interface IFinancialSummary {
  totalSalesForMonth: number; // Total sales for the month
  totalCostOfGoodsSold: number; // Total cost of goods sold
  totalNetRevenue: number; // Total net revenue
  totalGrossProfit: number; // Total gross profit
  totalVoidSales: number; // Total void sales
  totalInvitedSales: number; // Total invited sales
  totalTips: number; // Total tips collected
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

export interface IMonthlyBusinessReport {
  isReportOpen: boolean; // Indicates if the report is open for edits
  businessId: Types.ObjectId; // Business reference
  financialSummary: IFinancialSummary; // Financial summary for the month
  costBreakdown: ICostBreakdown; // Breakdown of various costs
  goodsSold: (typeof goodsReducedSchema)[]; // Goods sold during the month
  goodsVoided: (typeof goodsReducedSchema)[]; // Voided goods during the month
  goodsComplimentary: (typeof goodsReducedSchema)[]; // Complimentary goods
  supplierWasteAnalysis: ISupplierWasteAnalysis; // Analysis of supplier waste percentages
  totalCustomersServed: number; // Total number of customers served
  averageSpendingPerCustomer: number; // Average spending per customer
  paymentMethods: IPaymentMethod[]; // Array of payment methods used
  posSystemCommission: number; // POS system commission
}
