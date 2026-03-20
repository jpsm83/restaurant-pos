/**
 * aggregateDailyReportsIntoMonthly - Aggregates daily sales reports into monthly report
 *
 * Sums all calculated daily sales reports for the current month into the
 * open monthly business report. Also sums labour cost from Schedules.
 */

import mongoose, { Types } from "mongoose";
import DailySalesReport from "../models/dailySalesReport.ts";
import MonthlyBusinessReport from "../models/monthlyBusinessReport.ts";
import Schedule from "../models/schedule.ts";
import Business from "../models/business.ts";
import isObjectIdValid from "../utils/isObjectIdValid.ts";
import getWasteByBudgetImpactForMonth from "../inventories/getWasteByBudgetImpactForMonth.ts";
import {
  createMonthlyBusinessReport,
  type MonthlyReportOpen,
} from "./createMonthlyBusinessReport.ts";
import sendMonthlyReportReadyNotification from "./sendMonthlyReportReadyNotification.ts";

interface IGoodsReduced {
  businessGoodId: Types.ObjectId;
  quantity: number;
  totalPrice: number;
  totalCostPrice: number;
}

interface IPaymentMethod {
  paymentMethodType: string;
  methodBranch?: string;
  methodSalesTotal: number;
}

interface IMetrics {
  foodCostPercentage: number;
  laborCostPercentage: number;
  fixedCostPercentage: number;
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: number;
    lowBudgetImpact: number;
    mediumBudgetImpact: number;
    hightBudgetImpact: number;
    veryHightBudgetImpact: number;
  };
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getPreviousMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
}

function getMonthEnd(monthStart: Date): Date {
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

function mergeGoodsByBusinessGoodId(
  acc: IGoodsReduced[],
  items: IGoodsReduced[] | undefined,
): void {
  if (!items?.length) return;
  items.forEach((item) => {
    const idStr =
      typeof item.businessGoodId === "object" && item.businessGoodId != null
        ? (item.businessGoodId as Types.ObjectId).toString()
        : String(item.businessGoodId);
    const existing = acc.find(
      (x) =>
        (typeof x.businessGoodId === "object" && x.businessGoodId != null
          ? (x.businessGoodId as Types.ObjectId).toString()
          : String(x.businessGoodId)) === idStr,
    );
    if (existing) {
      existing.quantity += item.quantity ?? 1;
      existing.totalPrice = (existing.totalPrice ?? 0) + (item.totalPrice ?? 0);
      existing.totalCostPrice =
        (existing.totalCostPrice ?? 0) + (item.totalCostPrice ?? 0);
    } else {
      acc.push({
        businessGoodId: item.businessGoodId as Types.ObjectId,
        quantity: item.quantity ?? 1,
        totalPrice: item.totalPrice ?? 0,
        totalCostPrice: item.totalCostPrice ?? 0,
      });
    }
  });
}

function mergePaymentMethods(
  acc: IPaymentMethod[],
  methods: IPaymentMethod[] | undefined,
): void {
  if (!methods?.length) return;
  methods.forEach((pm) => {
    const existing = acc.find(
      (p) =>
        p.paymentMethodType === pm.paymentMethodType &&
        p.methodBranch === pm.methodBranch,
    );
    if (existing) {
      existing.methodSalesTotal += pm.methodSalesTotal ?? 0;
    } else {
      acc.push({
        paymentMethodType: pm.paymentMethodType,
        methodBranch: pm.methodBranch,
        methodSalesTotal: pm.methodSalesTotal ?? 0,
      });
    }
  });
}

/**
 * Aggregates calculated daily sales reports for the current month into the
 * open monthly business report. Also sums labour cost from Schedules.
 * Call this after calculateBusinessDailySalesReport.
 * Preserves totalFixedOperatingCost and totalExtraCost if already set on the report.
 */
const aggregateDailyReportsIntoMonthly = async (
  businessId: Types.ObjectId,
): Promise<void> => {
  if (isObjectIdValid([businessId]) !== true) {
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let shouldSendReadyNotification = false;
  let closedMonthLabel: string | null = null;

  try {
    const report = await createMonthlyBusinessReport(businessId, session);
    if (!report) {
      await session.abortTransaction();
      return;
    }

    const reportId = (report as MonthlyReportOpen)._id;
    const monthStart =
      (report as MonthlyReportOpen).monthReference ?? getMonthStart(new Date());
    const monthEnd = getMonthEnd(monthStart);

    const previousMonthStart = getPreviousMonthStart(monthStart);
    const previousMonthEnd = getMonthEnd(previousMonthStart);

    const openPrevMonthReport = (await MonthlyBusinessReport.findOne({
      businessId,
      monthReference: previousMonthStart,
      isReportOpen: true,
    })
      .select("_id monthReference isReportOpen")
      .session(session)
      .lean()) as {
      _id: Types.ObjectId;
      monthReference: Date;
      isReportOpen?: boolean;
    } | null;

    if (openPrevMonthReport) {
      const openDailyInPrevMonth = await DailySalesReport.exists({
        businessId,
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
        isDailyReportOpen: true,
      }).session(session);

      if (!openDailyInPrevMonth) {
        const closeResult = await MonthlyBusinessReport.updateOne(
          { _id: openPrevMonthReport._id, isReportOpen: true },
          { $set: { isReportOpen: false } },
          { session },
        );
        if (closeResult.modifiedCount > 0) {
          shouldSendReadyNotification = true;
          closedMonthLabel = previousMonthStart.toISOString().slice(0, 7);
        }
      }
    }

    const [
      dailyReports,
      schedules,
      existingReport,
      supplierWasteAnalysis,
      businessDoc,
    ] = await Promise.all([
      DailySalesReport.find({
        businessId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        dailyNetPaidAmount: { $exists: true, $ne: null },
      })
        .select(
          "dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue dailyCustomersServed dailyPosSystemCommission businessPaymentMethods dailySoldGoods dailyVoidedGoods dailyInvitedGoods",
        )
        .session(session)
        .lean(),
      Schedule.find({
        businessId,
        date: { $gte: monthStart, $lte: monthEnd },
      })
        .select("totalDayEmployeesCost")
        .session(session)
        .lean(),
      MonthlyBusinessReport.findById(reportId)
        .select(
          "costBreakdown.totalFixedOperatingCost costBreakdown.totalExtraCost",
        )
        .session(session)
        .lean(),
      getWasteByBudgetImpactForMonth(businessId, monthStart),
      Business.findById(businessId).select("metrics").session(session).lean(),
    ]);

    let totalSalesForMonth = 0;
    let totalNetRevenue = 0;
    let totalCostOfGoodsSold = 0;
    let totalTips = 0;
    let totalVoidSales = 0;
    let totalInvitedSales = 0;
    let totalCustomersServed = 0;
    let posSystemCommission = 0;
    const paymentMethodsAcc: IPaymentMethod[] = [];
    const goodsSoldAcc: IGoodsReduced[] = [];
    const goodsVoidedAcc: IGoodsReduced[] = [];
    const goodsComplimentaryAcc: IGoodsReduced[] = [];

    for (const d of dailyReports) {
      const doc = d as {
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
      };
      totalSalesForMonth += doc.dailyTotalSalesBeforeAdjustments ?? 0;
      totalNetRevenue += doc.dailyNetPaidAmount ?? 0;
      totalCostOfGoodsSold += doc.dailyCostOfGoodsSold ?? 0;
      totalTips += doc.dailyTipsReceived ?? 0;
      totalVoidSales += doc.dailyTotalVoidValue ?? 0;
      totalInvitedSales += doc.dailyTotalInvitedValue ?? 0;
      totalCustomersServed += doc.dailyCustomersServed ?? 0;
      posSystemCommission += doc.dailyPosSystemCommission ?? 0;
      mergePaymentMethods(paymentMethodsAcc, doc.businessPaymentMethods);
      mergeGoodsByBusinessGoodId(goodsSoldAcc, doc.dailySoldGoods);
      mergeGoodsByBusinessGoodId(goodsVoidedAcc, doc.dailyVoidedGoods);
      mergeGoodsByBusinessGoodId(goodsComplimentaryAcc, doc.dailyInvitedGoods);
    }

    const totalGrossProfit = totalNetRevenue - totalCostOfGoodsSold;
    const totalLaborCost = (
      schedules as { totalDayEmployeesCost?: number }[]
    ).reduce((sum, s) => sum + (s.totalDayEmployeesCost ?? 0), 0);

    const existingCost = existingReport as {
      costBreakdown?: {
        totalFixedOperatingCost?: number;
        totalExtraCost?: number;
      };
    } | null;
    const totalFixedOperatingCost =
      existingCost?.costBreakdown?.totalFixedOperatingCost ?? 0;
    const totalExtraCost = existingCost?.costBreakdown?.totalExtraCost ?? 0;
    const totalFoodCost = totalCostOfGoodsSold;
    const totalBeverageCost = 0;
    const totalOperatingCost =
      totalFoodCost +
      totalBeverageCost +
      totalLaborCost +
      totalFixedOperatingCost +
      totalExtraCost;

    const foodCostRatio =
      totalOperatingCost > 0 ? totalFoodCost / totalOperatingCost : 0;
    const beverageCostRatio =
      totalOperatingCost > 0 ? totalBeverageCost / totalOperatingCost : 0;
    const laborCostRatio =
      totalOperatingCost > 0 ? totalLaborCost / totalOperatingCost : 0;
    const fixedCostRatio =
      totalOperatingCost > 0 ? totalFixedOperatingCost / totalOperatingCost : 0;

    const profitMarginPercentage =
      totalSalesForMonth > 0
        ? (totalGrossProfit / totalSalesForMonth) * 100
        : 0;
    const voidSalesPercentage =
      totalSalesForMonth > 0 ? (totalVoidSales / totalSalesForMonth) * 100 : 0;
    const invitedSalesPercentage =
      totalSalesForMonth > 0
        ? (totalInvitedSales / totalSalesForMonth) * 100
        : 0;
    const salesPaymentCompletionPercentage =
      totalSalesForMonth > 0 ? (totalNetRevenue / totalSalesForMonth) * 100 : 0;
    const tipsToCostOfGoodsPercentage =
      totalCostOfGoodsSold > 0 ? (totalTips / totalCostOfGoodsSold) * 100 : 0;

    const averageSpendingPerCustomer =
      totalCustomersServed > 0 ? totalNetRevenue / totalCustomersServed : 0;

    const metrics = (businessDoc as { metrics?: IMetrics | null } | null)
      ?.metrics;

    const metricsComparison =
      metrics && totalOperatingCost > 0
        ? {
            foodCostPercentage: {
              targetValue: metrics.foodCostPercentage,
              actualValue: foodCostRatio * 100,
              delta: foodCostRatio * 100 - metrics.foodCostPercentage,
              isOverTarget: foodCostRatio * 100 > metrics.foodCostPercentage,
              isUnderTarget: foodCostRatio * 100 < metrics.foodCostPercentage,
            },
            laborCostPercentage: {
              targetValue: metrics.laborCostPercentage,
              actualValue: laborCostRatio * 100,
              delta: laborCostRatio * 100 - metrics.laborCostPercentage,
              isOverTarget: laborCostRatio * 100 > metrics.laborCostPercentage,
              isUnderTarget: laborCostRatio * 100 < metrics.laborCostPercentage,
            },
            fixedCostPercentage: {
              targetValue: metrics.fixedCostPercentage,
              actualValue: fixedCostRatio * 100,
              delta: fixedCostRatio * 100 - metrics.fixedCostPercentage,
              isOverTarget: fixedCostRatio * 100 > metrics.fixedCostPercentage,
              isUnderTarget: fixedCostRatio * 100 < metrics.fixedCostPercentage,
            },
            supplierGoodWastePercentage: supplierWasteAnalysis
              ? {
                  veryLowBudgetImpact: {
                    targetValue:
                      metrics.supplierGoodWastePercentage.veryLowBudgetImpact,
                    actualValue:
                      supplierWasteAnalysis.veryLowImpactWastePercentage ?? 0,
                    delta:
                      (supplierWasteAnalysis.veryLowImpactWastePercentage ??
                        0) -
                      metrics.supplierGoodWastePercentage.veryLowBudgetImpact,
                    isOverTarget:
                      (supplierWasteAnalysis.veryLowImpactWastePercentage ??
                        0) >
                      metrics.supplierGoodWastePercentage.veryLowBudgetImpact,
                    isUnderTarget:
                      (supplierWasteAnalysis.veryLowImpactWastePercentage ??
                        0) <
                      metrics.supplierGoodWastePercentage.veryLowBudgetImpact,
                  },
                  lowBudgetImpact: {
                    targetValue:
                      metrics.supplierGoodWastePercentage.lowBudgetImpact,
                    actualValue:
                      supplierWasteAnalysis.lowImpactWastePercentage ?? 0,
                    delta:
                      (supplierWasteAnalysis.lowImpactWastePercentage ?? 0) -
                      metrics.supplierGoodWastePercentage.lowBudgetImpact,
                    isOverTarget:
                      (supplierWasteAnalysis.lowImpactWastePercentage ?? 0) >
                      metrics.supplierGoodWastePercentage.lowBudgetImpact,
                    isUnderTarget:
                      (supplierWasteAnalysis.lowImpactWastePercentage ?? 0) <
                      metrics.supplierGoodWastePercentage.lowBudgetImpact,
                  },
                  mediumBudgetImpact: {
                    targetValue:
                      metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                    actualValue:
                      supplierWasteAnalysis.mediumImpactWastePercentage ?? 0,
                    delta:
                      (supplierWasteAnalysis.mediumImpactWastePercentage ?? 0) -
                      metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                    isOverTarget:
                      (supplierWasteAnalysis.mediumImpactWastePercentage ?? 0) >
                      metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                    isUnderTarget:
                      (supplierWasteAnalysis.mediumImpactWastePercentage ?? 0) <
                      metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                  },
                  hightBudgetImpact: {
                    targetValue:
                      metrics.supplierGoodWastePercentage.hightBudgetImpact,
                    actualValue:
                      supplierWasteAnalysis.highImpactWastePercentage ?? 0,
                    delta:
                      (supplierWasteAnalysis.highImpactWastePercentage ?? 0) -
                      metrics.supplierGoodWastePercentage.hightBudgetImpact,
                    isOverTarget:
                      (supplierWasteAnalysis.highImpactWastePercentage ?? 0) >
                      metrics.supplierGoodWastePercentage.hightBudgetImpact,
                    isUnderTarget:
                      (supplierWasteAnalysis.highImpactWastePercentage ?? 0) <
                      metrics.supplierGoodWastePercentage.hightBudgetImpact,
                  },
                  veryHightBudgetImpact: {
                    targetValue:
                      metrics.supplierGoodWastePercentage.veryHightBudgetImpact,
                    actualValue:
                      supplierWasteAnalysis.veryHighImpactWastePercentage ?? 0,
                    delta:
                      (supplierWasteAnalysis.veryHighImpactWastePercentage ??
                        0) -
                      metrics.supplierGoodWastePercentage.veryHightBudgetImpact,
                    isOverTarget:
                      (supplierWasteAnalysis.veryHighImpactWastePercentage ??
                        0) >
                      metrics.supplierGoodWastePercentage.veryHightBudgetImpact,
                    isUnderTarget:
                      (supplierWasteAnalysis.veryHighImpactWastePercentage ??
                        0) <
                      metrics.supplierGoodWastePercentage.veryHightBudgetImpact,
                  },
                }
              : undefined,
          }
        : undefined;

    await MonthlyBusinessReport.updateOne(
      { _id: reportId },
      {
        $set: {
          financialSummary: {
            totalSalesForMonth,
            totalCostOfGoodsSold,
            totalNetRevenue,
            totalGrossProfit,
            totalVoidSales,
            totalInvitedSales,
            totalTips,
            financialPercentages: {
              salesPaymentCompletionPercentage,
              profitMarginPercentage,
              voidSalesPercentage,
              invitedSalesPercentage,
              tipsToCostOfGoodsPercentage,
            },
          },
          costBreakdown: {
            totalFoodCost,
            totalBeverageCost,
            totalLaborCost,
            totalFixedOperatingCost,
            totalExtraCost,
            totalOperatingCost,
            costPercentages: {
              foodCostRatio,
              beverageCostRatio,
              laborCostRatio,
              fixedCostRatio,
            },
          },
          goodsSold: goodsSoldAcc,
          goodsVoided: goodsVoidedAcc,
          goodsComplimentary: goodsComplimentaryAcc,
          supplierWasteAnalysis,
          metricsComparison,
          totalCustomersServed,
          averageSpendingPerCustomer,
          paymentMethods: paymentMethodsAcc,
          posSystemCommission,
        },
      },
      { session },
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  if (shouldSendReadyNotification && closedMonthLabel) {
    await sendMonthlyReportReadyNotification(businessId, closedMonthLabel);
  }
};

export default aggregateDailyReportsIntoMonthly;
