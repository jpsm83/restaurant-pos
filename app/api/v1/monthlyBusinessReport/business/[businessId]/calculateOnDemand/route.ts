import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import Schedule from "@/lib/db/models/schedule";
import Business from "@/lib/db/models/business";
import { IGoodsReduced } from "@/lib/interface/IDailySalesReport";
import { IPaymentMethod } from "@/lib/interface/IPaymentMethod";
import { IMetrics } from "@/lib/interface/IBusiness";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { getWasteByBudgetImpactForMonth } from "@/app/api/v1/inventories/utils/getWasteByBudgetImpactForMonth";

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

// @desc    Calculate monthly business report on demand without persisting
// @route   GET /api/v1/monthlyBusinessReport/business/:businessId/calculateOnDemand?month=YYYY-MM
// @access  Private (manager-only in UI; no extra auth here beyond existing middleware)
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // YYYY-MM

    let monthStart: Date;
    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(monthIndex) ||
        monthIndex < 0 ||
        monthIndex > 11
      ) {
        return new NextResponse(
          JSON.stringify({
            message: "Invalid month query param. Use YYYY-MM (e.g. 2024-06).",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    } else {
      monthStart = getMonthStart(new Date());
    }
    const monthEnd = getMonthEnd(monthStart);

    await connectDb();

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
          "dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue dailyCustomersServed dailyPosSystemCommission businessPaymentMethods dailySoldGoods dailyVoidedGoods dailyInvitedGoods"
        )
        .lean(),
      Schedule.find({
        businessId,
        date: { $gte: monthStart, $lte: monthEnd },
      })
        .select("totalDayEmployeesCost")
        .lean(),
      MonthlyBusinessReport.findOne({
        businessId,
        monthReference: monthStart,
      })
        .select(
          "isReportOpen costBreakdown.totalFixedOperatingCost costBreakdown.totalExtraCost"
        )
        .lean(),
      getWasteByBudgetImpactForMonth(businessId, monthStart),
      Business.findById(businessId).select("metrics").lean(),
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
      if (doc.businessPaymentMethods?.length) {
        doc.businessPaymentMethods.forEach((pm) => {
          const existing = paymentMethodsAcc.find(
            (p) =>
              p.paymentMethodType === pm.paymentMethodType &&
              p.methodBranch === pm.methodBranch
          );
          if (existing) {
            existing.methodSalesTotal += pm.methodSalesTotal ?? 0;
          } else {
            paymentMethodsAcc.push({
              paymentMethodType: pm.paymentMethodType,
              methodBranch: pm.methodBranch,
              methodSalesTotal: pm.methodSalesTotal ?? 0,
            });
          }
        });
      }
      if (doc.dailySoldGoods?.length) {
        doc.dailySoldGoods.forEach((item) => {
          const existing = goodsSoldAcc.find(
            (x) =>
              (x.businessGoodId as Types.ObjectId)?.toString() ===
              (item.businessGoodId as Types.ObjectId)?.toString()
          );
          if (existing) {
            existing.quantity += item.quantity ?? 1;
            existing.totalPrice =
              (existing.totalPrice ?? 0) + (item.totalPrice ?? 0);
            existing.totalCostPrice =
              (existing.totalCostPrice ?? 0) + (item.totalCostPrice ?? 0);
          } else {
            goodsSoldAcc.push({
              businessGoodId: item.businessGoodId as Types.ObjectId,
              quantity: item.quantity ?? 1,
              totalPrice: item.totalPrice ?? 0,
              totalCostPrice: item.totalCostPrice ?? 0,
            });
          }
        });
      }
      if (doc.dailyVoidedGoods?.length) {
        doc.dailyVoidedGoods.forEach((item) => {
          const existing = goodsVoidedAcc.find(
            (x) =>
              (x.businessGoodId as Types.ObjectId)?.toString() ===
              (item.businessGoodId as Types.ObjectId)?.toString()
          );
          if (existing) {
            existing.quantity += item.quantity ?? 1;
            existing.totalPrice =
              (existing.totalPrice ?? 0) + (item.totalPrice ?? 0);
            existing.totalCostPrice =
              (existing.totalCostPrice ?? 0) + (item.totalCostPrice ?? 0);
          } else {
            goodsVoidedAcc.push({
              businessGoodId: item.businessGoodId as Types.ObjectId,
              quantity: item.quantity ?? 1,
              totalPrice: item.totalPrice ?? 0,
              totalCostPrice: item.totalCostPrice ?? 0,
            });
          }
        });
      }
      if (doc.dailyInvitedGoods?.length) {
        doc.dailyInvitedGoods.forEach((item) => {
          const existing = goodsComplimentaryAcc.find(
            (x) =>
              (x.businessGoodId as Types.ObjectId)?.toString() ===
              (item.businessGoodId as Types.ObjectId)?.toString()
          );
          if (existing) {
            existing.quantity += item.quantity ?? 1;
            existing.totalPrice =
              (existing.totalPrice ?? 0) + (item.totalPrice ?? 0);
            existing.totalCostPrice =
              (existing.totalCostPrice ?? 0) + (item.totalCostPrice ?? 0);
          } else {
            goodsComplimentaryAcc.push({
              businessGoodId: item.businessGoodId as Types.ObjectId,
              quantity: item.quantity ?? 1,
              totalPrice: item.totalPrice ?? 0,
              totalCostPrice: item.totalCostPrice ?? 0,
            });
          }
        });
      }
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
            supplierGoodWastePercentage:
              supplierWasteAnalysis != null
                ? {
                    veryLowBudgetImpact: {
                      targetValue:
                        metrics.supplierGoodWastePercentage.veryLowBudgetImpact,
                      actualValue:
                        supplierWasteAnalysis.veryLowImpactWastePercentage ?? 0,
                      delta:
                        (supplierWasteAnalysis.veryLowImpactWastePercentage ??
                          0) -
                        metrics.supplierGoodWastePercentage
                          .veryLowBudgetImpact,
                      isOverTarget:
                        (supplierWasteAnalysis.veryLowImpactWastePercentage ??
                          0) >
                        metrics.supplierGoodWastePercentage
                          .veryLowBudgetImpact,
                      isUnderTarget:
                        (supplierWasteAnalysis.veryLowImpactWastePercentage ??
                          0) <
                        metrics.supplierGoodWastePercentage
                          .veryLowBudgetImpact,
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
                        (supplierWasteAnalysis.mediumImpactWastePercentage ??
                          0) -
                        metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                      isOverTarget:
                        (supplierWasteAnalysis.mediumImpactWastePercentage ??
                          0) >
                        metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                      isUnderTarget:
                        (supplierWasteAnalysis.mediumImpactWastePercentage ??
                          0) <
                        metrics.supplierGoodWastePercentage.mediumBudgetImpact,
                    },
                    hightBudgetImpact: {
                      targetValue:
                        metrics.supplierGoodWastePercentage.hightBudgetImpact,
                      actualValue:
                        supplierWasteAnalysis.highImpactWastePercentage ?? 0,
                      delta:
                        (supplierWasteAnalysis.highImpactWastePercentage ??
                          0) -
                        metrics.supplierGoodWastePercentage.hightBudgetImpact,
                      isOverTarget:
                        (supplierWasteAnalysis.highImpactWastePercentage ??
                          0) >
                        metrics.supplierGoodWastePercentage.hightBudgetImpact,
                      isUnderTarget:
                        (supplierWasteAnalysis.highImpactWastePercentage ??
                          0) <
                        metrics.supplierGoodWastePercentage.hightBudgetImpact,
                    },
                    veryHightBudgetImpact: {
                      targetValue:
                        metrics.supplierGoodWastePercentage.veryHightBudgetImpact,
                      actualValue:
                        supplierWasteAnalysis.veryHighImpactWastePercentage ??
                        0,
                      delta:
                        (supplierWasteAnalysis.veryHighImpactWastePercentage ??
                          0) -
                        metrics.supplierGoodWastePercentage
                          .veryHightBudgetImpact,
                      isOverTarget:
                        (supplierWasteAnalysis.veryHighImpactWastePercentage ??
                          0) >
                        metrics.supplierGoodWastePercentage
                          .veryHightBudgetImpact,
                      isUnderTarget:
                        (supplierWasteAnalysis.veryHighImpactWastePercentage ??
                          0) <
                        metrics.supplierGoodWastePercentage
                          .veryHightBudgetImpact,
                    },
                  }
                : undefined,
          }
        : undefined;

    const responseBody = {
      businessId,
      monthReference: monthStart,
      isReportOpen:
        (existingReport as { isReportOpen?: boolean } | null)?.isReportOpen ??
        false,
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
    };

    return new NextResponse(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "On-demand monthly business report calculation failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

