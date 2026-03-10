import mongoose, { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import Schedule from "@/lib/db/models/schedule";
import { IGoodsReduced } from "@/lib/interface/IDailySalesReport";
import { IPaymentMethod } from "@/lib/interface/IPaymentMethod";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import {
  createMonthlyBusinessReport,
  type MonthlyReportOpen,
} from "./createMonthlyBusinessReport";

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getMonthEnd(monthStart: Date): Date {
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
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
 * Aggregates calculated daily sales reports for the current month into the
 * open monthly business report. Also sums labour cost from Schedules.
 * Call this after calculateBusinessDailySalesReport (e.g. from that route).
 * Preserves totalFixedOperatingCost and totalExtraCost if already set on the report.
 */
export async function aggregateDailyReportsIntoMonthly(
  businessId: Types.ObjectId
): Promise<void> {
  if (isObjectIdValid([businessId]) !== true) {
    return;
  }

  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

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

    const [dailyReports, schedules, existingReport] = await Promise.all([
      DailySalesReport.find({
        businessId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        dailyNetPaidAmount: { $exists: true, $ne: null },
      })
        .select(
          "dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue dailyCustomersServed dailyPosSystemCommission businessPaymentMethods dailySoldGoods dailyVoidedGoods dailyInvitedGoods"
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
        .select("costBreakdown.totalFixedOperatingCost costBreakdown.totalExtraCost")
        .session(session)
        .lean(),
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
    const totalLaborCost = (schedules as { totalDayEmployeesCost?: number }[]).reduce(
      (sum, s) => sum + (s.totalDayEmployeesCost ?? 0),
      0
    );

    const existingCost =
      existingReport as {
        costBreakdown?: {
          totalFixedOperatingCost?: number;
          totalExtraCost?: number;
        };
      } | null;
    const totalFixedOperatingCost =
      existingCost?.costBreakdown?.totalFixedOperatingCost ?? 0;
    const totalExtraCost =
      existingCost?.costBreakdown?.totalExtraCost ?? 0;
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
      totalSalesForMonth > 0 ? (totalGrossProfit / totalSalesForMonth) * 100 : 0;
    const voidSalesPercentage =
      totalSalesForMonth > 0 ? (totalVoidSales / totalSalesForMonth) * 100 : 0;
    const invitedSalesPercentage =
      totalSalesForMonth > 0 ? (totalInvitedSales / totalSalesForMonth) * 100 : 0;
    const salesPaymentCompletionPercentage =
      totalSalesForMonth > 0 ? (totalNetRevenue / totalSalesForMonth) * 100 : 0;
    const tipsToCostOfGoodsPercentage =
      totalCostOfGoodsSold > 0 ? (totalTips / totalCostOfGoodsSold) * 100 : 0;

    const averageSpendingPerCustomer =
      totalCustomersServed > 0 ? totalNetRevenue / totalCustomersServed : 0;

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
          supplierWasteAnalysis: {
            veryLowImpactWastePercentage: 0,
            lowImpactWastePercentage: 0,
            mediumImpactWastePercentage: 0,
            highImpactWastePercentage: 0,
            veryHighImpactWastePercentage: 0,
          },
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
