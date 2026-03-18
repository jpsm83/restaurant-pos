import { Schema, model } from "mongoose";
import { paymentMethod } from "./paymentMethod.js";
import { goodsReducedSchema } from "./dailySalesReport.js";

const monthlyBusinessReportSchema = new Schema(
  {
    isReportOpen: { type: Boolean, default: true },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    monthReference: {
      type: Date,
      required: [true, "Month reference is required!"],
      index: true,
    },
    financialSummary: {
      totalSalesForMonth: { type: Number },
      totalCostOfGoodsSold: { type: Number },
      totalNetRevenue: { type: Number },
      totalGrossProfit: { type: Number },
      totalVoidSales: { type: Number },
      totalInvitedSales: { type: Number },
      totalTips: { type: Number },
      financialPercentages: {
        salesPaymentCompletionPercentage: { type: Number },
        profitMarginPercentage: { type: Number },
        voidSalesPercentage: { type: Number },
        invitedSalesPercentage: { type: Number },
        tipsToCostOfGoodsPercentage: { type: Number },
      },
    },
    costBreakdown: {
      totalFoodCost: { type: Number },
      totalBeverageCost: { type: Number },
      totalLaborCost: { type: Number },
      totalFixedOperatingCost: { type: Number },
      totalExtraCost: { type: Number },
      totalOperatingCost: { type: Number },
      costPercentages: {
        foodCostRatio: { type: Number },
        beverageCostRatio: { type: Number },
        laborCostRatio: { type: Number },
        fixedCostRatio: { type: Number },
      },
    },
    goodsSold: { type: [goodsReducedSchema], default: undefined },
    goodsVoided: { type: [goodsReducedSchema], default: undefined },
    goodsComplimentary: { type: [goodsReducedSchema], default: undefined },
    supplierWasteAnalysis: {
      veryLowImpactWastePercentage: { type: Number },
      lowImpactWastePercentage: { type: Number },
      mediumImpactWastePercentage: { type: Number },
      highImpactWastePercentage: { type: Number },
      veryHighImpactWastePercentage: { type: Number },
    },
    metricsComparison: {
      foodCostPercentage: {
        targetValue: { type: Number },
        actualValue: { type: Number },
        delta: { type: Number },
        isOverTarget: { type: Boolean },
        isUnderTarget: { type: Boolean },
      },
      laborCostPercentage: {
        targetValue: { type: Number },
        actualValue: { type: Number },
        delta: { type: Number },
        isOverTarget: { type: Boolean },
        isUnderTarget: { type: Boolean },
      },
      fixedCostPercentage: {
        targetValue: { type: Number },
        actualValue: { type: Number },
        delta: { type: Number },
        isOverTarget: { type: Boolean },
        isUnderTarget: { type: Boolean },
      },
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: {
          targetValue: { type: Number },
          actualValue: { type: Number },
          delta: { type: Number },
          isOverTarget: { type: Boolean },
          isUnderTarget: { type: Boolean },
        },
        lowBudgetImpact: {
          targetValue: { type: Number },
          actualValue: { type: Number },
          delta: { type: Number },
          isOverTarget: { type: Boolean },
          isUnderTarget: { type: Boolean },
        },
        mediumBudgetImpact: {
          targetValue: { type: Number },
          actualValue: { type: Number },
          delta: { type: Number },
          isOverTarget: { type: Boolean },
          isUnderTarget: { type: Boolean },
        },
        hightBudgetImpact: {
          targetValue: { type: Number },
          actualValue: { type: Number },
          delta: { type: Number },
          isOverTarget: { type: Boolean },
          isUnderTarget: { type: Boolean },
        },
        veryHightBudgetImpact: {
          targetValue: { type: Number },
          actualValue: { type: Number },
          delta: { type: Number },
          isOverTarget: { type: Boolean },
          isUnderTarget: { type: Boolean },
        },
      },
    },
    totalCustomersServed: { type: Number },
    averageSpendingPerCustomer: { type: Number },
    paymentMethods: { type: [paymentMethod], default: undefined },
    posSystemCommission: { type: Number },
  },
  {
    timestamps: true,
    trim: true,
  }
);

monthlyBusinessReportSchema.index(
  { businessId: 1, monthReference: 1 },
  { unique: true }
);

const MonthlyBusinessReport = model("MonthlyBusinessReport", monthlyBusinessReportSchema);
export default MonthlyBusinessReport;
