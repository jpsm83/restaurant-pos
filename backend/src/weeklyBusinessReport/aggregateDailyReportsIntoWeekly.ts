/**
 * aggregateDailyReportsIntoWeekly - Aggregates daily sales reports into weekly report
 *
 * Sums all calculated daily sales reports for a given week into the
 * weekly business report. Also sums labour cost from Schedules.
 */

import mongoose, { Types } from "mongoose";
import DailySalesReport from "../models/dailySalesReport.ts";
import WeeklyBusinessReport from "../models/weeklyBusinessReport.ts";
import Schedule from "../models/schedule.ts";
import Business from "../models/business.ts";
import { isObjectIdValid } from "../utils/isObjectIdValid.ts";
import {
  getWeekReference,
  createWeeklyBusinessReport,
  type WeeklyReportOpen,
} from "./createWeeklyBusinessReport.ts";
import { getWasteByBudgetImpactForMonth } from "../inventories/getWasteByBudgetImpactForMonth.ts";

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
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: number;
    lowBudgetImpact: number;
    mediumBudgetImpact: number;
    hightBudgetImpact: number;
    veryHightBudgetImpact: number;
  };
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function mergeGoodsByBusinessGoodId(
  acc: IGoodsReduced[],
  items: IGoodsReduced[] | undefined
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
          : String(x.businessGoodId)) === idStr
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
  methods: IPaymentMethod[] | undefined
): void {
  if (!methods?.length) return;
  methods.forEach((pm) => {
    const existing = acc.find(
      (p) =>
        p.paymentMethodType === pm.paymentMethodType &&
        p.methodBranch === pm.methodBranch
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
 * Aggregates calculated daily sales reports for a given week into the
 * weekly business report. Also sums labour cost from Schedules.
 * Weekly reports ignore fixed/extra costs and focus on variable performance.
 */
export async function aggregateDailyReportsIntoWeekly(
  businessId: Types.ObjectId,
  anyDateInWeek: Date,
  weeklyReportStartDay: number
): Promise<void> {
  if (isObjectIdValid([businessId]) !== true) {
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const weekReference = getWeekReference(anyDateInWeek, weeklyReportStartDay);
    const report = await createWeeklyBusinessReport(
      businessId,
      weekReference,
      session
    );
    if (!report) {
      await session.abortTransaction();
      return;
    }

    const reportId = (report as WeeklyReportOpen)._id;
    const weekStart = weekReference;
    const weekEnd = getWeekEnd(weekStart);

    const [dailyReports, schedules, supplierWasteAnalysis, businessDoc] =
      await Promise.all([
        DailySalesReport.find({
          businessId,
          createdAt: { $gte: weekStart, $lte: weekEnd },
          dailyNetPaidAmount: { $exists: true, $ne: null },
        })
          .select(
            "dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue dailyCustomersServed dailyPosSystemCommission businessPaymentMethods dailySoldGoods dailyVoidedGoods dailyInvitedGoods"
          )
          .session(session)
          .lean(),
        Schedule.find({
          businessId,
          date: { $gte: weekStart, $lte: weekEnd },
        })
          .select("totalDayEmployeesCost")
          .session(session)
          .lean(),
        getWasteByBudgetImpactForMonth(businessId, weekStart),
        Business.findById(businessId).select("metrics").session(session).lean(),
      ]);

    let totalSalesForWeek = 0;
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
      totalSalesForWeek += doc.dailyTotalSalesBeforeAdjustments ?? 0;
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

    const totalFoodCost = totalCostOfGoodsSold;
    const totalBeverageCost = 0;
    const totalOperatingCost =
      totalFoodCost + totalBeverageCost + totalLaborCost;

    const foodCostRatio =
      totalOperatingCost > 0 ? totalFoodCost / totalOperatingCost : 0;
    const beverageCostRatio =
      totalOperatingCost > 0 ? totalBeverageCost / totalOperatingCost : 0;
    const laborCostRatio =
      totalOperatingCost > 0 ? totalLaborCost / totalOperatingCost : 0;

    const profitMarginPercentage =
      totalSalesForWeek > 0
        ? (totalGrossProfit / totalSalesForWeek) * 100
        : 0;
    const voidSalesPercentage =
      totalSalesForWeek > 0 ? (totalVoidSales / totalSalesForWeek) * 100 : 0;
    const invitedSalesPercentage =
      totalSalesForWeek > 0
        ? (totalInvitedSales / totalSalesForWeek) * 100
        : 0;
    const salesPaymentCompletionPercentage =
      totalSalesForWeek > 0 ? (totalNetRevenue / totalSalesForWeek) * 100 : 0;
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

    await WeeklyBusinessReport.updateOne(
      { _id: reportId },
      {
        $set: {
          financialSummary: {
            totalSalesForWeek,
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
            totalOperatingCost,
            costPercentages: {
              foodCostRatio,
              beverageCostRatio,
              laborCostRatio,
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
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
