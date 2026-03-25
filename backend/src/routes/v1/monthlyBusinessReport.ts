import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IGoodsReduced } from "../../../../packages/interfaces/IDailySalesReport.ts";
import type { IPaymentMethod } from "../../../../packages/interfaces/IPaymentMethod.ts";
import type { IMetrics } from "../../../../packages/interfaces/IBusiness.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import getWasteByBudgetImpactForMonth from "../../inventories/getWasteByBudgetImpactForMonth.ts";
import MonthlyBusinessReport from "../../models/monthlyBusinessReport.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import Schedule from "../../models/schedule.ts";
import Business from "../../models/business.ts";

function parseMonthStart(ym: string): Date | null {
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12)
    return null;
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
}

function monthEnd(monthStart: Date): Date {
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
    999,
  );
}

export const monthlyBusinessReportRoutes: FastifyPluginAsync = async (app) => {
  // GET /monthlyBusinessReport - list all (with optional filters)
  app.get("/", async (req, reply) => {
    try {
      const queryParams = req.query as {
        businessId?: string;
        startMonth?: string;
        endMonth?: string;
      };

      const filter: {
        businessId?: Types.ObjectId;
        monthReference?: { $gte: Date; $lte: Date };
      } = {};

      if (queryParams.businessId) {
        if (isObjectIdValid([queryParams.businessId]) !== true) {
          return reply.code(400).send({ message: "Invalid business ID!" });
        }
        filter.businessId = new Types.ObjectId(queryParams.businessId);
      }

      if (queryParams.startMonth && queryParams.endMonth) {
        const start = parseMonthStart(queryParams.startMonth);
        const end = parseMonthStart(queryParams.endMonth);
        if (!start || !end) {
          return reply.code(400).send({
            message:
              "Invalid month range. Use startMonth and endMonth as YYYY-MM.",
          });
        }
        if (start > monthEnd(end)) {
          return reply.code(400).send({
            message:
              "Invalid month range, startMonth must be before or equal to endMonth.",
          });
        }
        filter.monthReference = { $gte: start, $lte: monthEnd(end) };
      }

      const reports = await MonthlyBusinessReport.find(filter)
        .sort({ monthReference: -1 })
        .lean();

      if (!reports.length) {
        return reply.code(404).send({ message: "No monthly reports found!" });
      }

      return reply.code(200).send(reports);
    } catch (error) {
      return reply.code(500).send({
        message: "Get monthly business reports failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /monthlyBusinessReport/:monthlyReportId - get by ID
  app.get("/:monthlyReportId", async (req, reply) => {
    try {
      const params = req.params as { monthlyReportId?: string };
      const monthlyReportId = params.monthlyReportId;

      if (!monthlyReportId || isObjectIdValid([monthlyReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid monthly report ID!" });
      }

      const report =
        await MonthlyBusinessReport.findById(monthlyReportId).lean();

      if (!report) {
        return reply.code(404).send({ message: "Monthly report not found!" });
      }

      return reply.code(200).send(report);
    } catch (error) {
      return reply.code(500).send({
        message: "Get monthly business report by id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /monthlyBusinessReport/:monthlyReportId - update
  app.patch("/:monthlyReportId", async (req, reply) => {
    try {
      const params = req.params as { monthlyReportId?: string };
      const monthlyReportId = params.monthlyReportId;

      if (!monthlyReportId || isObjectIdValid([monthlyReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid monthly report ID!" });
      }

      const body = req.body as {
        totalFixedOperatingCost?: number;
        totalExtraCost?: number;
      };

      const { totalFixedOperatingCost, totalExtraCost } = body;
      if (
        totalFixedOperatingCost === undefined &&
        totalExtraCost === undefined
      ) {
        return reply.code(400).send({
          message:
            "Provide at least one of totalFixedOperatingCost or totalExtraCost.",
        });
      }

      const report = await MonthlyBusinessReport.findById(monthlyReportId)
        .select("isReportOpen costBreakdown")
        .lean();

      if (!report) {
        return reply.code(404).send({ message: "Monthly report not found!" });
      }

      if (!(report as { isReportOpen?: boolean }).isReportOpen) {
        return reply.code(400).send({
          message: "Cannot update a closed monthly report.",
        });
      }

      const cost = (report as { costBreakdown?: Record<string, unknown> })
        .costBreakdown;
      const totalFoodCost = (cost?.totalFoodCost as number) ?? 0;
      const totalBeverageCost = (cost?.totalBeverageCost as number) ?? 0;
      const totalLaborCost = (cost?.totalLaborCost as number) ?? 0;
      const newFixed =
        totalFixedOperatingCost !== undefined
          ? totalFixedOperatingCost
          : ((cost?.totalFixedOperatingCost as number) ?? 0);
      const newExtra =
        totalExtraCost !== undefined
          ? totalExtraCost
          : ((cost?.totalExtraCost as number) ?? 0);

      const totalOperatingCost =
        totalFoodCost +
        totalBeverageCost +
        totalLaborCost +
        newFixed +
        newExtra;

      const foodCostRatio =
        totalOperatingCost > 0 ? totalFoodCost / totalOperatingCost : 0;
      const beverageCostRatio =
        totalOperatingCost > 0 ? totalBeverageCost / totalOperatingCost : 0;
      const laborCostRatio =
        totalOperatingCost > 0 ? totalLaborCost / totalOperatingCost : 0;
      const fixedCostRatio =
        totalOperatingCost > 0 ? newFixed / totalOperatingCost : 0;

      await MonthlyBusinessReport.updateOne(
        { _id: monthlyReportId },
        {
          $set: {
            "costBreakdown.totalFixedOperatingCost": newFixed,
            "costBreakdown.totalExtraCost": newExtra,
            "costBreakdown.totalOperatingCost": totalOperatingCost,
            "costBreakdown.costPercentages.foodCostRatio": foodCostRatio,
            "costBreakdown.costPercentages.beverageCostRatio":
              beverageCostRatio,
            "costBreakdown.costPercentages.laborCostRatio": laborCostRatio,
            "costBreakdown.costPercentages.fixedCostRatio": fixedCostRatio,
          },
        },
      );

      const updated =
        await MonthlyBusinessReport.findById(monthlyReportId).lean();
      return reply.code(200).send(updated);
    } catch (error) {
      return reply.code(500).send({
        message: "Update monthly business report fixed/extra costs failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /monthlyBusinessReport/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid business ID!" });
      }

      const queryParams = req.query as {
        startMonth?: string;
        endMonth?: string;
      };

      const filter: {
        businessId: Types.ObjectId;
        monthReference?: { $gte: Date; $lte: Date };
      } = {
        businessId: new Types.ObjectId(businessId),
      };

      if (queryParams.startMonth && queryParams.endMonth) {
        const start = parseMonthStart(queryParams.startMonth);
        const end = parseMonthStart(queryParams.endMonth);
        if (!start || !end) {
          return reply.code(400).send({
            message:
              "Invalid month range. Use startMonth and endMonth as YYYY-MM.",
          });
        }
        if (start > monthEnd(end)) {
          return reply.code(400).send({
            message:
              "Invalid month range, startMonth must be before or equal to endMonth.",
          });
        }
        filter.monthReference = { $gte: start, $lte: monthEnd(end) };
      }

      const reports = await MonthlyBusinessReport.find(filter)
        .sort({ monthReference: 1 })
        .lean();

      if (!reports.length) {
        return reply.code(404).send({ message: "No monthly reports found!" });
      }

      return reply.code(200).send(reports);
    } catch (error) {
      return reply.code(500).send({
        message: "Get monthly business reports by business id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /monthlyBusinessReport/business/:businessId/calculateOnDemand - calculate on demand
  app.get("/business/:businessId/calculateOnDemand", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid business ID!" });
      }

      const queryParams = req.query as { month?: string };

      let monthStart: Date;
      if (queryParams.month) {
        const [yearStr, monthStr] = queryParams.month.split("-");
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1;
        if (
          !Number.isInteger(year) ||
          !Number.isInteger(monthIndex) ||
          monthIndex < 0 ||
          monthIndex > 11
        ) {
          return reply.code(400).send({
            message: "Invalid month query param. Use YYYY-MM (e.g. 2024-06).",
          });
        }
        monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      } else {
        monthStart = getMonthStart(new Date());
      }
      const monthEndDate = getMonthEnd(monthStart);

      const businessObjId = new Types.ObjectId(businessId);

      const [
        dailyReports,
        schedules,
        existingReport,
        supplierWasteAnalysis,
        businessDoc,
      ] = await Promise.all([
        DailySalesReport.find({
          businessId: businessObjId,
          createdAt: { $gte: monthStart, $lte: monthEndDate },
          dailyNetPaidAmount: { $exists: true, $ne: null },
        })
          .select(
            "dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue dailyCustomersServed dailyPosSystemCommission businessPaymentMethods dailySoldGoods dailyVoidedGoods dailyInvitedGoods",
          )
          .lean(),
        Schedule.find({
          businessId: businessObjId,
          date: { $gte: monthStart, $lte: monthEndDate },
        })
          .select("totalDayEmployeesCost")
          .lean(),
        MonthlyBusinessReport.findOne({
          businessId: businessObjId,
          monthReference: monthStart,
        })
          .select(
            "isReportOpen costBreakdown.totalFixedOperatingCost costBreakdown.totalExtraCost",
          )
          .lean(),
        getWasteByBudgetImpactForMonth(businessObjId, monthStart),
        Business.findById(businessObjId).select("metrics").lean(),
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
                p.methodBranch === pm.methodBranch,
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
                (item.businessGoodId as Types.ObjectId)?.toString(),
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
                (item.businessGoodId as Types.ObjectId)?.toString(),
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
                (item.businessGoodId as Types.ObjectId)?.toString(),
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
        totalOperatingCost > 0
          ? totalFixedOperatingCost / totalOperatingCost
          : 0;

      const profitMarginPercentage =
        totalSalesForMonth > 0
          ? (totalGrossProfit / totalSalesForMonth) * 100
          : 0;
      const voidSalesPercentage =
        totalSalesForMonth > 0
          ? (totalVoidSales / totalSalesForMonth) * 100
          : 0;
      const invitedSalesPercentage =
        totalSalesForMonth > 0
          ? (totalInvitedSales / totalSalesForMonth) * 100
          : 0;
      const salesPaymentCompletionPercentage =
        totalSalesForMonth > 0
          ? (totalNetRevenue / totalSalesForMonth) * 100
          : 0;
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
                isOverTarget:
                  laborCostRatio * 100 > metrics.laborCostPercentage,
                isUnderTarget:
                  laborCostRatio * 100 < metrics.laborCostPercentage,
              },
              fixedCostPercentage: {
                targetValue: metrics.fixedCostPercentage,
                actualValue: fixedCostRatio * 100,
                delta: fixedCostRatio * 100 - metrics.fixedCostPercentage,
                isOverTarget:
                  fixedCostRatio * 100 > metrics.fixedCostPercentage,
                isUnderTarget:
                  fixedCostRatio * 100 < metrics.fixedCostPercentage,
              },
              supplierGoodWastePercentage: undefined,
            }
          : undefined;

      const responseBody = {
        businessId: businessObjId,
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

      return reply.code(200).send(responseBody);
    } catch (error) {
      return reply.code(500).send({
        message: "On-demand monthly business report calculation failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};
