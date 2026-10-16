/**
 * MonthlyBusinessReport Routes — report retrieval, the fixed/extra-cost PATCH
 * and the on-demand calculation.
 *
 * Every route declares its params/query/body as a strict zod DTO from
 * `packages/schemas/businessReports.ts`; validation happens at the boundary and
 * every error is raised as an `AppError` so the global handler emits RFC 9457
 * `application/problem+json`. The month-range ordering rule and the PATCH
 * at-least-one-field rule stay in the route as named post-parse checks.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IGoodsReduced } from "restaurant-pos-packages/interfaces/IDailySalesReport";
import type { IPaymentMethod } from "restaurant-pos-packages/interfaces/IPaymentMethod";
import type { IMetrics } from "restaurant-pos-packages/interfaces/IBusiness";

import getWasteByBudgetImpactForMonth from "../../inventories/getWasteByBudgetImpactForMonth.ts";
import MonthlyBusinessReport from "../../models/monthlyBusinessReport.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import Schedule from "../../models/schedule.ts";
import Business from "../../models/business.ts";
import { badRequest, notFound } from "../../errors/appError.ts";
import {
  calculateMonthlyReportQuerySchema,
  monthlyBusinessParamsSchema,
  monthlyBusinessReportListQuerySchema,
  monthlyBusinessReportRangeQuerySchema,
  monthlyReportIdParamsSchema,
  updateMonthlyBusinessReportBodySchema,
  type CalculateMonthlyReportQuery,
  type MonthlyBusinessParams,
  type MonthlyBusinessReportListQuery,
  type MonthlyBusinessReportRangeQuery,
  type MonthlyReportIdParams,
  type UpdateMonthlyBusinessReportBody,
} from "restaurant-pos-packages/schemas/businessReports";

/** The local midnight of a `YYYY-MM` month (the schema has validated it). */
function parseMonthStart(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
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

/**
 * Post-parse check: turn a `startMonth`/`endMonth` pair into a `monthReference`
 * bound, raising a `badRequest` when the ordering is invalid. Absent or
 * incomplete pairs yield no filter, preserving "unbounded" behaviour.
 */
function monthReferenceFilter(
  startMonth?: string,
  endMonth?: string,
): { $gte: Date; $lte: Date } | undefined {
  if (!startMonth || !endMonth) return undefined;

  const start = parseMonthStart(startMonth);
  const end = parseMonthStart(endMonth);
  if (start > monthEnd(end)) {
    throw badRequest(
      "Invalid month range, startMonth must be before or equal to endMonth.",
    );
  }
  return { $gte: start, $lte: monthEnd(end) };
}

export const monthlyBusinessReportRoutes: FastifyPluginAsync = async (app) => {
  // GET /monthlyBusinessReport - list all (with optional filters)
  app.get<{ Querystring: MonthlyBusinessReportListQuery }>(
    "/",
    { schema: { querystring: monthlyBusinessReportListQuerySchema } },
    async (req, reply) => {
      const { businessId, startMonth, endMonth } = req.query;

      const filter: {
        businessId?: Types.ObjectId;
        monthReference?: { $gte: Date; $lte: Date };
      } = {};

      if (businessId) {
        filter.businessId = new Types.ObjectId(businessId);
      }

      const monthReference = monthReferenceFilter(startMonth, endMonth);
      if (monthReference) {
        filter.monthReference = monthReference;
      }

      const reports = await MonthlyBusinessReport.find(filter)
        .sort({ monthReference: -1 })
        .lean();

      if (!reports.length) {
        throw notFound("No monthly reports found!");
      }

      return reply.code(200).send(reports);
    },
  );

  // GET /monthlyBusinessReport/:monthlyReportId - get by ID
  app.get<{ Params: MonthlyReportIdParams }>(
    "/:monthlyReportId",
    { schema: { params: monthlyReportIdParamsSchema } },
    async (req, reply) => {
      const { monthlyReportId } = req.params;

      const report =
        await MonthlyBusinessReport.findById(monthlyReportId).lean();

      if (!report) {
        throw notFound("Monthly report not found!");
      }

      return reply.code(200).send(report);
    },
  );

  // PATCH /monthlyBusinessReport/:monthlyReportId - update
  app.patch<{
    Params: MonthlyReportIdParams;
    Body: UpdateMonthlyBusinessReportBody;
  }>(
    "/:monthlyReportId",
    {
      schema: {
        params: monthlyReportIdParamsSchema,
        body: updateMonthlyBusinessReportBodySchema,
      },
    },
    async (req, reply) => {
      const { monthlyReportId } = req.params;
      const { totalFixedOperatingCost, totalExtraCost } = req.body;

      if (
        totalFixedOperatingCost === undefined &&
        totalExtraCost === undefined
      ) {
        throw badRequest(
          "Provide at least one of totalFixedOperatingCost or totalExtraCost.",
        );
      }

      const report = await MonthlyBusinessReport.findById(monthlyReportId)
        .select("isReportOpen costBreakdown")
        .lean();

      if (!report) {
        throw notFound("Monthly report not found!");
      }

      if (!(report as { isReportOpen?: boolean }).isReportOpen) {
        throw badRequest("Cannot update a closed monthly report.");
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
    },
  );

  // GET /monthlyBusinessReport/business/:businessId - get by business
  app.get<{
    Params: MonthlyBusinessParams;
    Querystring: MonthlyBusinessReportRangeQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: monthlyBusinessParamsSchema,
        querystring: monthlyBusinessReportRangeQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { startMonth, endMonth } = req.query;

      const filter: {
        businessId: Types.ObjectId;
        monthReference?: { $gte: Date; $lte: Date };
      } = {
        businessId: new Types.ObjectId(businessId),
      };

      const monthReference = monthReferenceFilter(startMonth, endMonth);
      if (monthReference) {
        filter.monthReference = monthReference;
      }

      const reports = await MonthlyBusinessReport.find(filter)
        .sort({ monthReference: 1 })
        .lean();

      if (!reports.length) {
        throw notFound("No monthly reports found!");
      }

      return reply.code(200).send(reports);
    },
  );

  // GET /monthlyBusinessReport/business/:businessId/calculateOnDemand - calculate on demand
  app.get<{
    Params: MonthlyBusinessParams;
    Querystring: CalculateMonthlyReportQuery;
  }>(
    "/business/:businessId/calculateOnDemand",
    {
      schema: {
        params: monthlyBusinessParamsSchema,
        querystring: calculateMonthlyReportQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { month } = req.query;

      let monthStart: Date;
      if (month) {
        const [yearStr, monthStr] = month.split("-");
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1;
        monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      } else {
        monthStart = getMonthStart(new Date());
      }
      const monthEndDate = getMonthEnd(monthStart);

      // `getWasteByBudgetImpactForMonth` keys off a canonical (UTC-midnight)
      // month date, so hand it one derived from the requested month rather than
      // the server-local `monthStart`.
      const monthReferenceForWaste = new Date(
        Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), 1),
      );

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
        getWasteByBudgetImpactForMonth(businessObjId, monthReferenceForWaste),
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
    },
  );
};
