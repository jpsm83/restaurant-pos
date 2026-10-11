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
import {
  avgSpendPerCustomer,
  breakEvenSales,
  calculateCostRatiosByTotalSales,
  calculateFinancialPercentages,
  contributionMarginRatio,
  grossProfit,
  minimumDailySalesTarget,
  netProfit,
  netProfitMarginPct,
} from "../reports/businessMetrics/calculations.ts";
import {
  getVariableCostsV1,
  mapDailyReportToCanonicalInputs,
} from "../reports/businessMetrics/dataContract.ts";
import { isSupportedTimezone } from "../../../packages/schemas/primitives.ts";
import {
  addMonthsToCalendarDate,
  calendarDateToUtcMidnight,
  daysInCalendarMonth,
  resolveLocalDate,
  resolveMonthBounds,
} from "../utils/timezoneResolver.ts";

interface IGoodsReduced {
  businessGoodId: Types.ObjectId;
  quantity?: number;
  totalPrice?: number;
  totalCostPrice?: number;
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
      existing.quantity = (existing.quantity ?? 0) + (item.quantity ?? 1);
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
 * Aggregates calculated daily sales reports for the business-local month
 * containing `anyDateInMonth` into the open monthly business report. Also sums
 * labour cost from Schedules. Call this after calculateBusinessDailySalesReport.
 * Preserves totalFixedOperatingCost and totalExtraCost if already set on the report.
 */
const aggregateDailyReportsIntoMonthly = async (
  businessId: Types.ObjectId,
  anyDateInMonth: Date = new Date(),
): Promise<void> => {
  if (isObjectIdValid([businessId]) !== true) {
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let shouldSendReadyNotification = false;
  let closedMonthLabel: string | null = null;

  try {
    // The business timezone is the reference zone for every boundary below; a
    // missing or invalid value falls back to UTC without error.
    const businessDoc = await Business.findById(businessId)
      .select("metrics timezone")
      .session(session)
      .lean();

    const storedTimezone = (businessDoc as { timezone?: string } | null)
      ?.timezone;
    const timeZone = isSupportedTimezone(storedTimezone) ? storedTimezone : "UTC";

    // Resolve the requested month in the business's local calendar, then to its
    // inclusive UTC bounds. `monthReference` stays a plain local date so reports
    // are keyed identically regardless of the server's OS timezone.
    const localDate = resolveLocalDate(anyDateInMonth, timeZone);
    const monthStartDate = `${localDate.slice(0, 7)}-01`;
    const monthReference = calendarDateToUtcMidnight(monthStartDate);
    const monthBounds = resolveMonthBounds(localDate, timeZone);

    const report = await createMonthlyBusinessReport(
      businessId,
      monthReference,
      session,
    );
    if (!report) {
      await session.abortTransaction();
      return;
    }

    const reportId = (report as MonthlyReportOpen)._id;

    const previousMonthStartDate = addMonthsToCalendarDate(monthStartDate, -1);
    const previousMonthReference = calendarDateToUtcMidnight(previousMonthStartDate);
    const previousMonthBounds = resolveMonthBounds(
      previousMonthStartDate,
      timeZone,
    );

    const openPrevMonthReport = (await MonthlyBusinessReport.findOne({
      businessId,
      monthReference: previousMonthReference,
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
        createdAt: {
          $gte: previousMonthBounds.start,
          $lte: previousMonthBounds.end,
        },
        isDailyReportOpen: true,
      }).session(session);

      if (!openDailyInPrevMonth) {
        const closeResult = await MonthlyBusinessReport.updateOne(
          { _id: openPrevMonthReport._id, isReportOpen: true },
          { $set: { isReportOpen: false } },
          { session },
        );
        // Send ready-notification only when this execution actually closes
        // the previous monthly report (idempotent close gate).
        if (closeResult.modifiedCount === 1) {
          shouldSendReadyNotification = true;
          closedMonthLabel = previousMonthStartDate.slice(0, 7);
        }
      }
    }

    // Sequential reads on `session`: one ClientSession must not run operations in parallel.
    const dailyReports = await DailySalesReport.find({
      businessId,
      createdAt: { $gte: monthBounds.start, $lte: monthBounds.end },
      dailyNetPaidAmount: { $exists: true, $ne: null },
    })
      .select(
        "dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue dailyCustomersServed dailyPosSystemCommission businessPaymentMethods dailySoldGoods dailyVoidedGoods dailyInvitedGoods",
      )
      .session(session)
      .lean();

    const schedules = await Schedule.find({
      businessId,
      date: { $gte: monthBounds.start, $lte: monthBounds.end },
    })
      .select("totalDayEmployeesCost")
      .session(session)
      .lean();

    const existingReport = await MonthlyBusinessReport.findById(reportId)
      .select(
        "costBreakdown.totalFixedOperatingCost costBreakdown.totalExtraCost",
      )
      .session(session)
      .lean();

    const supplierWasteAnalysis = await getWasteByBudgetImpactForMonth(
      businessId,
      monthReference,
    );

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
      const mapped = mapDailyReportToCanonicalInputs(d as any);
      totalSalesForMonth += mapped.totalSales;
      totalNetRevenue += mapped.netRevenue;
      totalCostOfGoodsSold += mapped.cogs;
      totalTips += mapped.tips;
      totalVoidSales += mapped.voidSales;
      totalInvitedSales += mapped.invitedSales;
      totalCustomersServed += mapped.customersServed;
      posSystemCommission += mapped.posSystemCommission;
      mergePaymentMethods(paymentMethodsAcc, mapped.paymentMethods);
      mergeGoodsByBusinessGoodId(goodsSoldAcc, mapped.soldGoods);
      mergeGoodsByBusinessGoodId(goodsVoidedAcc, mapped.voidedGoods);
      mergeGoodsByBusinessGoodId(goodsComplimentaryAcc, mapped.invitedGoods);
    }

    const totalGrossProfit = grossProfit(totalNetRevenue, totalCostOfGoodsSold);
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
    const totalNetProfit = netProfit(totalNetRevenue, totalOperatingCost);

    const {
      foodCostRatio,
      beverageCostRatio,
      laborCostRatio,
      fixedCostRatio,
    } = calculateCostRatiosByTotalSales({
      totalSales: totalSalesForMonth,
      totalFoodCost,
      totalBeverageCost,
      totalLaborCost,
      totalFixedOperatingCost,
    });

    const {
      profitMarginPercentage,
      voidSalesPercentage,
      invitedSalesPercentage,
      salesPaymentCompletionPercentage,
      tipsToCostOfGoodsPercentage,
    } = calculateFinancialPercentages({
      totalSales: totalSalesForMonth,
      totalNetRevenue,
      totalGrossProfit,
      totalVoidSales,
      totalInvitedSales,
      totalTips,
      totalCostOfGoodsSold,
    });

    const averageSpendingPerCustomer = avgSpendPerCustomer(
      totalNetRevenue,
      totalCustomersServed,
    );

    // Phase-3 data contract: V1 variable costs are COGS + labor.
    // Utilities are intentionally excluded until explicit source fields exist.
    const _v1VariableCosts = getVariableCostsV1(totalCostOfGoodsSold, totalLaborCost);
    const v1ContributionMarginRatio = contributionMarginRatio(
      totalSalesForMonth,
      _v1VariableCosts,
    );
    // Treat fixed + extra monthly costs as fixed-style obligations for break-even planning.
    const breakEvenSalesValue = breakEvenSales(
      totalFixedOperatingCost + totalExtraCost,
      v1ContributionMarginRatio,
    );
    const daysInMonth = daysInCalendarMonth(localDate);
    const minimumDailySalesTargetValue = minimumDailySalesTarget(
      breakEvenSalesValue,
      daysInMonth,
    );
    const netProfitMarginPercentage = netProfitMarginPct(
      totalSalesForMonth,
      totalNetProfit,
    );

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
              actualValue: (fixedCostRatio ?? 0) * 100,
              delta: (fixedCostRatio ?? 0) * 100 - metrics.fixedCostPercentage,
              isOverTarget: (fixedCostRatio ?? 0) * 100 > metrics.fixedCostPercentage,
              isUnderTarget: (fixedCostRatio ?? 0) * 100 < metrics.fixedCostPercentage,
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
            totalNetProfit,
            totalVoidSales,
            totalInvitedSales,
            totalTips,
            breakEvenSales: breakEvenSalesValue,
            minimumDailySalesTarget: minimumDailySalesTargetValue,
            financialPercentages: {
              salesPaymentCompletionPercentage,
              profitMarginPercentage,
              netProfitMarginPercentage,
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
              fixedCostRatio: fixedCostRatio ?? 0,
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
