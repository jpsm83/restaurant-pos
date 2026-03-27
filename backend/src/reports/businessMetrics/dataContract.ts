import type { IPaymentMethod } from "../../../../packages/interfaces/IPaymentMethod.ts";
import type { IGoodsReduced } from "../../../../packages/interfaces/IDailySalesReport.ts";

export interface DailyReportAggregationSource {
  dailyTotalSalesBeforeAdjustments?: number;
  dailyNetPaidAmount?: number;
  dailyCostOfGoodsSold?: number;
  dailyTipsReceived?: number;
  dailyTotalVoidValue?: number;
  dailyTotalInvitedValue?: number;
  dailyCustomersServed?: number;
  dailyPosSystemCommission?: number;
  businessPaymentMethods?: IPaymentMethod[];
  dailySoldGoods?: IGoodsReduced[];
  dailyVoidedGoods?: IGoodsReduced[];
  dailyInvitedGoods?: IGoodsReduced[];
}

export interface CanonicalDailyMetricInputs {
  totalSales: number;
  netRevenue: number;
  cogs: number;
  tips: number;
  voidSales: number;
  invitedSales: number;
  customersServed: number;
  posSystemCommission: number;
  paymentMethods?: IPaymentMethod[];
  soldGoods?: IGoodsReduced[];
  voidedGoods?: IGoodsReduced[];
  invitedGoods?: IGoodsReduced[];
}

const toNumber = (value?: number): number =>
  typeof value === "number" ? value : 0;

/**
 * Locks the Phase-3 data contract mapping:
 * DSR top-level daily fields -> canonical weekly/monthly metric inputs.
 */
export const mapDailyReportToCanonicalInputs = (
  report: DailyReportAggregationSource,
): CanonicalDailyMetricInputs => ({
  totalSales: toNumber(report.dailyTotalSalesBeforeAdjustments),
  netRevenue: toNumber(report.dailyNetPaidAmount),
  cogs: toNumber(report.dailyCostOfGoodsSold),
  tips: toNumber(report.dailyTipsReceived),
  voidSales: toNumber(report.dailyTotalVoidValue),
  invitedSales: toNumber(report.dailyTotalInvitedValue),
  customersServed: toNumber(report.dailyCustomersServed),
  posSystemCommission: toNumber(report.dailyPosSystemCommission),
  paymentMethods: report.businessPaymentMethods,
  soldGoods: report.dailySoldGoods,
  voidedGoods: report.dailyVoidedGoods,
  invitedGoods: report.dailyInvitedGoods,
});

/**
 * Phase-3 locked V1 variable-cost policy.
 * Utilities remain out of scope until explicit source fields exist.
 */
export const getVariableCostsV1 = (cogs: number, laborCost: number): number =>
  cogs + laborCost;
