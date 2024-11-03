import { Schema, model, models } from "mongoose";
import { paymentMethod } from "./paymentMethod";
import { goodsReducedSchema } from "./dailySalesReport";

const monthlyBusinessReportSchema = new Schema(
  {
    isReportOpen: { type: Boolean, required: true, default: true },
    // Indicates if the monthly report is still open for edits. When true, employees can still add sales. When false, the report is locked for further edits, and all calculations are final.
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    // Reference to the business associated with this monthly report.
    financialSummary: {
      totalSalesForMonth: { type: Number },
      // Total amount of all sales, including voided and invited orders.
      totalCostOfGoodsSold: { type: Number },
      // Sum of the cost price of all goods sold, including voided and invited items.
      totalNetRevenue: { type: Number },
      // Net revenue (total sales minus any voided/invited orders).
      totalGrossProfit: { type: Number },
      // Total gross profit calculated as (totalNetRevenue - totalCostOfGoodsSold).
      totalVoidSales: { type: Number },
      // Sum of sales that were voided.
      totalInvitedSales: { type: Number },
      // Sum of sales attributed to invited or complimentary goods.
      totalTips: { type: Number },
      // Total tips collected over the month.
      financialPercentages: {
        salesPaymentCompletionPercentage: { type: Number },
        // Percentage of sales that were successfully paid for during the month, relative to totalSalesForMonth.
        profitMarginPercentage: { type: Number },
        // Profit margin, calculated as (totalGrossProfit / totalSalesForMonth).
        voidSalesPercentage: { type: Number },
        // Percentage of sales that were voided, relative to totalSalesForMonth.
        invitedSalesPercentage: { type: Number },
        // Percentage of sales that were complimentary/invited, relative to totalSalesForMonth.
        tipsToCostOfGoodsPercentage: { type: Number },
        // Percentage of total tips compared to the totalCostOfGoodsSold.
      },
      // Percentages related to various financial metrics for a clearer overview.
    },
    costBreakdown: {
      totalFoodCost: { type: Number },
      // Total cost of food items sold, including voided and invited orders.
      totalBeverageCost: { type: Number },
      // Total cost of beverages sold, including voided and invited orders.
      totalLaborCost: { type: Number },
      // Total labor cost for the month.
      totalFixedOperatingCost: { type: Number },
      // Total fixed operating costs (e.g., rent, utilities).
      totalExtraCost: { type: Number },
      // Any one-time or additional costs incurred during the month.
      totalOperatingCost: { type: Number },
      // Total sum of all operational costs (food, beverage, labor, fixed, and extra costs).
      costPercentages: {
        foodCostRatio: { type: Number },
        // Ratio of food cost to the total operating cost.
        beverageCostRatio: { type: Number },
        // Ratio of beverage cost to the total operating cost.
        laborCostRatio: { type: Number },
        // Ratio of labor cost to the total operating cost.
        fixedCostRatio: { type: Number },
        // Ratio of fixed costs (e.g., rent, utilities) to the total operating cost.
      },
      // Percentages reflecting the proportion of each cost category relative to total operating costs.
    },
    goodsSold: [goodsReducedSchema],
    // Array containing details of all goods sold during the month.
    goodsVoided: [goodsReducedSchema],
    // Array containing details of all goods voided during the month.
    goodsComplimentary: [goodsReducedSchema],
    // Array containing details of all goods provided as complimentary (invited) during the month.
    supplierWasteAnalysis: {
      veryLowImpactWastePercentage: { type: Number },
      // Average percentage of wasted goods with very low budget impact.
      lowImpactWastePercentage: { type: Number },
      // Average percentage of wasted goods with low budget impact.
      mediumImpactWastePercentage: { type: Number },
      // Average percentage of wasted goods with medium budget impact.
      highImpactWastePercentage: { type: Number },
      // Average percentage of wasted goods with high budget impact.
      veryHighImpactWastePercentage: { type: Number },
      // Average percentage of wasted goods with very high budget impact.
    },
    // Percentages representing the waste of supplier goods categorized by their budget impact level.
    totalCustomersServed: { type: Number },
    // Total number of customers served during the month.
    averageSpendingPerCustomer: { type: Number },
    // Average amount each customer spent, calculated as (totalNetRevenue / totalCustomersServed).
    paymentMethods: [paymentMethod],
    // Array of all payment methods used during the month along with their respective sales totals.
    posSystemCommission: { type: Number },
    // Commission charged by the POS system used for processing payments.
  },
  {
    timestamps: true,
  }
);

const MonthlyBusinessReport =
  models.MonthlyBusinessReport ||
  model("MonthlyBusinessReport", monthlyBusinessReportSchema);
export default MonthlyBusinessReport;
