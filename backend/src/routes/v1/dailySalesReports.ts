/**
 * DailySalesReports Routes — report retrieval plus the calculate, close and
 * reconcile flows.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `packages/schemas/dailySalesReports.ts`; validation and sanitization happen at
 * the boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. Cross-field and database-dependent
 * rules stay in the route as named post-parse checks: the manager/business-match
 * guards and the date/reference-number range rules.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  IActorDailySalesReport,
  IGoodsReduced,
  IDailySalesReport,
} from "restaurant-pos-packages/interfaces/IDailySalesReport";
import type { IPaymentMethod } from "restaurant-pos-packages/interfaces/IPaymentMethod";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";

import reconcileEmployeesDailySalesReport from "../../dailySalesReports/updateEmployeeDailySalesReport.ts";
import aggregateDailyReportsIntoWeekly from "../../weeklyBusinessReport/aggregateDailyReportsIntoWeekly.ts";
import aggregateDailyReportsIntoMonthly from "../../monthlyBusinessReport/aggregateDailyReportsIntoMonthly.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import User from "../../models/user.ts";
import Employee from "../../models/employee.ts";
import Business from "../../models/business.ts";
import Order from "../../models/order.ts";
import SalesInstance from "../../models/salesInstance.ts";
import SalesPoint from "../../models/salesPoint.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import { isAggregateMismatchCheckEnabled } from "../../dailySalesReports/rolloutControls.ts";
import { recordAggregateMismatchCheck } from "../../dailySalesReports/rolloutTelemetry.ts";
import { buildReconciledDailyPayload } from "../../dailySalesReports/reconciliationCore.ts";
import { resolveBaseCommissionPercent } from "restaurant-pos-packages/utils/subscriptionCatalogue";
import {
  badRequest,
  conflict,
  forbidden,
  internal,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import {
  calculateUsersReportBodySchema,
  dailySalesReportIdParamsSchema,
  dailySalesReportsBusinessParamsSchema,
  dailySalesReportsBusinessQuerySchema,
  dailySalesReportsIncludeDeletedQuerySchema,
  type CalculateUsersReportBody,
  type DailySalesReportIdParams,
  type DailySalesReportsBusinessParams,
  type DailySalesReportsBusinessQuery,
  type DailySalesReportsIncludeDeletedQuery,
} from "restaurant-pos-packages/schemas/dailySalesReports";
import * as enums from "restaurant-pos-packages/enums";
import { isSupportedTimezone } from "restaurant-pos-packages/schemas/primitives";
import { resolveDayBounds } from "../../utils/timezoneResolver.ts";

const { managementRolesEnums } = enums;

export const dailySalesReportsRoutes: FastifyPluginAsync = async (app) => {
  const refreshWeeklyAndMonthlyReports = async (
    businessId: Types.ObjectId,
    weeklyDateReference: Date,
    weeklyReportStartDay: number,
    triggerSource: "calculateBusinessReport" | "closeDailyReport",
  ): Promise<{ allSucceeded: boolean; failed: string[] }> => {
    const settled = await Promise.allSettled([
      aggregateDailyReportsIntoWeekly(
        businessId,
        weeklyDateReference,
        weeklyReportStartDay,
      ),
      aggregateDailyReportsIntoMonthly(businessId),
    ]);

    const failed: string[] = [];

    if (settled[0].status === "rejected") {
      failed.push("weekly");
      app.log.error(
        {
          triggerSource,
          businessId: String(businessId),
          error: settled[0].reason,
        },
        "weekly report refresh failed",
      );
    } else {
      app.log.info(
        { triggerSource, businessId: String(businessId) },
        "weekly report refresh succeeded",
      );
    }

    if (settled[1].status === "rejected") {
      failed.push("monthly");
      app.log.error(
        {
          triggerSource,
          businessId: String(businessId),
          error: settled[1].reason,
        },
        "monthly report refresh failed",
      );
    } else {
      app.log.info(
        { triggerSource, businessId: String(businessId) },
        "monthly report refresh succeeded",
      );
    }

    return {
      allSucceeded: failed.length === 0,
      failed,
    };
  };

  const buildReconciledDailyReportPayload = async (
    dailyReferenceNumber: number,
    businessId: Types.ObjectId,
  ) => {
    const [orders, businessDoc] = await Promise.all([
      Order.find({
        businessId,
        dailyReferenceNumber,
        billingStatus: { $in: ["Paid", "Void", "Invitation"] },
      })
        .select(
          "createdByUserId businessId dailyReferenceNumber salesInstanceId billingStatus orderGrossPrice orderNetPrice orderTips orderCostPrice paymentMethod businessGoodId addOns",
        )
        .populate({
          path: "salesInstanceId",
          select: "salesPointId",
          model: SalesInstance,
          populate: {
            path: "salesPointId",
            model: SalesPoint,
            select: "salesPointType",
          },
        })
        .lean(),
      Business.findById(businessId).select("subscription").lean(),
    ]);

    return buildReconciledDailyPayload({
      orders: orders as any,
      subscription: (businessDoc as { subscription?: string } | null)?.subscription,
    });
  };

  const hasAggregateMismatch = (
    current: {
      dailyTotalSalesBeforeAdjustments?: number;
      dailyNetPaidAmount?: number;
      dailyCostOfGoodsSold?: number;
      dailyTipsReceived?: number;
      dailyTotalVoidValue?: number;
      dailyTotalInvitedValue?: number;
    },
    next: {
      dailyTotalSalesBeforeAdjustments: number;
      dailyNetPaidAmount: number;
      dailyCostOfGoodsSold: number;
      dailyTipsReceived: number;
      dailyTotalVoidValue: number;
      dailyTotalInvitedValue: number;
    },
  ): boolean => {
    const epsilon = 0.0001;
    const diff = (a?: number, b?: number) => Math.abs((a ?? 0) - (b ?? 0));
    return (
      diff(current.dailyTotalSalesBeforeAdjustments, next.dailyTotalSalesBeforeAdjustments) > epsilon ||
      diff(current.dailyNetPaidAmount, next.dailyNetPaidAmount) > epsilon ||
      diff(current.dailyCostOfGoodsSold, next.dailyCostOfGoodsSold) > epsilon ||
      diff(current.dailyTipsReceived, next.dailyTipsReceived) > epsilon ||
      diff(current.dailyTotalVoidValue, next.dailyTotalVoidValue) > epsilon ||
      diff(current.dailyTotalInvitedValue, next.dailyTotalInvitedValue) > epsilon
    );
  };

  /**
   * Post-parse guard: the caller must be an authenticated manager. Returns the
   * manager's business id or raises `unauthorized`/`forbidden`.
   */
  const resolveManagerBusinessId = async (req: {
    authSession?: { type: string; id: string };
  }): Promise<Types.ObjectId> => {
    if (!req.authSession || req.authSession.type !== "user") {
      throw unauthorized("Unauthorized");
    }

    const userObjectId = new Types.ObjectId(req.authSession.id);
    const employeeDoc = (await Employee.findOne({
      userId: userObjectId,
    })
      .select("allEmployeeRoles businessId")
      .lean()) as IEmployee | null;

    if (
      !employeeDoc ||
      !employeeDoc.businessId ||
      !managementRolesEnums.some(
        (role) => employeeDoc.allEmployeeRoles?.includes(role),
      )
    ) {
      throw forbidden("Forbidden");
    }

    return typeof employeeDoc.businessId === "object" &&
      employeeDoc.businessId !== null &&
      "_id" in employeeDoc.businessId
      ? (employeeDoc.businessId as { _id: Types.ObjectId })._id
      : new Types.ObjectId(String(employeeDoc.businessId));
  };

  // GET /dailySalesReports - list all
  app.get<{ Querystring: DailySalesReportsIncludeDeletedQuery }>(
    "/",
    {
      preValidation: [createAuthHook(app)],
      schema: { querystring: dailySalesReportsIncludeDeletedQuerySchema },
    },
    async (_req, reply) => {
      const businessId = await resolveManagerBusinessId(_req);
      const { includeDeleted = false } = _req.query;

      const dailySalesReports = await DailySalesReport.find(
        withSoftDeleteFilter({ businessId }, includeDeleted),
      )
      .populate({
        path: "employeesDailySalesReport.userId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "deliveryDailySalesReport.userId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "selfOrderingSalesReport.userId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .lean();

      if (!dailySalesReports.length) {
        throw notFound("No daily reports found!");
      }
      return reply.code(200).send(dailySalesReports);
    },
  );

  // GET /dailySalesReports/:dailySalesReportId - get by ID
  app.get<{
    Params: DailySalesReportIdParams;
    Querystring: DailySalesReportsIncludeDeletedQuery;
  }>(
    "/:dailySalesReportId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: dailySalesReportIdParamsSchema,
        querystring: dailySalesReportsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { dailySalesReportId } = req.params;
      const { includeDeleted = false } = req.query;

      const dailySalesReport = await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }, includeDeleted),
      )
        .populate({
          path: "employeesDailySalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .populate({
          path: "deliveryDailySalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .populate({
          path: "selfOrderingSalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .lean();

      if (!dailySalesReport) {
        throw notFound("Daily report not found!");
      }

      const reportBusinessId =
        typeof (dailySalesReport as { businessId?: Types.ObjectId }).businessId ===
          "object" &&
        (dailySalesReport as { businessId?: Types.ObjectId }).businessId !== null
          ? ((dailySalesReport as { businessId?: Types.ObjectId })
              .businessId as Types.ObjectId)
          : undefined;
      if (
        !reportBusinessId ||
        String(reportBusinessId) !== String(managerBusinessId)
      ) {
        throw forbidden("Forbidden");
      }

      return reply.code(200).send(dailySalesReport);
    },
  );

  // DELETE /dailySalesReports/:dailySalesReportId - delete
  app.delete<{ Params: DailySalesReportIdParams }>(
    "/:dailySalesReportId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: dailySalesReportIdParamsSchema },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { dailySalesReportId } = req.params;
      const report = await DailySalesReport.findOne({
        _id: dailySalesReportId,
        businessId: managerBusinessId,
      })
        .setOptions({ includeDeleted: true })
        .select("deleted")
        .lean();
      if (!report) {
        throw notFound("Daily report not found!");
      }
      if (report.deleted) {
        throw conflict("Daily report already deleted!");
      }

      const wasDeleted = await markAsDeletedById(
        DailySalesReport as mongoose.Model<IDailySalesReport & { deleted: boolean }>,
        dailySalesReportId,
        { deletedBy: req.authSession?.id },
      );
      if (!wasDeleted) {
        throw conflict("Daily report already deleted!");
      }

      return reply.code(200).send(`Daily report ${dailySalesReportId} deleted`);
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/calculateBusinessReport - calculate business report
  app.patch<{ Params: DailySalesReportIdParams }>(
    "/:dailySalesReportId/calculateBusinessReport",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: dailySalesReportIdParamsSchema },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { dailySalesReportId } = req.params;

      const dailySalesReport = (await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
      )
        .select(
          "dailyReferenceNumber businessId dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue",
        )
        .lean()) as {
        dailyReferenceNumber: number;
        businessId: Types.ObjectId | { _id: Types.ObjectId };
        dailyTotalSalesBeforeAdjustments?: number;
        dailyNetPaidAmount?: number;
        dailyCostOfGoodsSold?: number;
        dailyTipsReceived?: number;
        dailyTotalVoidValue?: number;
        dailyTotalInvitedValue?: number;
      } | null;

      if (!dailySalesReport) {
        throw notFound("Daily report not found!");
      }

      const businessId =
        typeof dailySalesReport.businessId === "object" &&
        dailySalesReport.businessId !== null &&
        "_id" in dailySalesReport.businessId
          ? (dailySalesReport.businessId as { _id: Types.ObjectId })._id
          : (dailySalesReport.businessId as Types.ObjectId);
      if (String(businessId) !== String(managerBusinessId)) {
        throw forbidden(
          "You are not allowed to calculate the daily sales report!",
        );
      }

      const dailyReportWithUsers = (await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
      )
        .select(
          "_id dailyReferenceNumber employeesDailySalesReport deliveryDailySalesReport selfOrderingSalesReport businessId",
        )
        .populate({
          path: "businessId",
          select: "subscription reportingConfig.weeklyReportStartDay",
          model: Business,
        })
        .lean()) as {
        _id: Types.ObjectId;
        dailyReferenceNumber: number;
        businessId:
          | {
              _id: Types.ObjectId;
              subscription?: string;
              reportingConfig?: { weeklyReportStartDay?: number };
            }
          | Types.ObjectId;
        employeesDailySalesReport?: IActorDailySalesReport[];
        deliveryDailySalesReport?: IActorDailySalesReport;
        selfOrderingSalesReport?: IActorDailySalesReport[];
      } | null;

      if (!dailyReportWithUsers) {
        throw notFound("Daily report not found!");
      }

      const businessGoodsReport = {
        goodsSold: [] as IGoodsReduced[],
        goodsVoid: [] as IGoodsReduced[],
        goodsInvited: [] as IGoodsReduced[],
      };

      const dailySalesReportObj = {
        businessPaymentMethods: [] as IPaymentMethod[],
        dailyTotalSalesBeforeAdjustments: 0,
        dailyNetPaidAmount: 0,
        dailyTipsReceived: 0,
        dailyCostOfGoodsSold: 0,
        dailyProfit: 0,
        dailyCustomersServed: 0,
        dailyAverageCustomerExpenditure: 0,
        dailySoldGoods: [] as IGoodsReduced[],
        dailyVoidedGoods: [] as IGoodsReduced[],
        dailyInvitedGoods: [] as IGoodsReduced[],
        dailyTotalVoidValue: 0,
        dailyTotalInvitedValue: 0,
        dailyPosSystemCommission: 0,
      };

      const mergeGoods = (array: IGoodsReduced[], businessGood: IGoodsReduced) => {
        const existingGood = array.find(
          (item) =>
            (item.businessGoodId as Types.ObjectId)?.toString() ===
            (businessGood.businessGoodId as Types.ObjectId)?.toString(),
        );

        if (existingGood) {
          existingGood.quantity += businessGood.quantity ?? 1;
          existingGood.totalPrice =
            (existingGood.totalPrice ?? 0) + (businessGood.totalPrice ?? 0);
          existingGood.totalCostPrice =
            (existingGood.totalCostPrice ?? 0) +
            (businessGood.totalCostPrice ?? 0);
          return;
        }

        array.push({
          businessGoodId: businessGood.businessGoodId,
          quantity: businessGood.quantity ?? 1,
          totalPrice: businessGood.totalPrice ?? 0,
          totalCostPrice: businessGood.totalCostPrice ?? 0,
        });
      };

      const aggregateActorRow = (row: IActorDailySalesReport | undefined) => {
        if (!row) return;

        if (row.employeePaymentMethods) {
          row.employeePaymentMethods.forEach((payment: IPaymentMethod) => {
            const existingPayment = dailySalesReportObj.businessPaymentMethods.find(
              (p: IPaymentMethod) =>
                p.paymentMethodType === payment.paymentMethodType &&
                p.methodBranch === payment.methodBranch,
            );

            if (existingPayment) {
              existingPayment.methodSalesTotal += payment.methodSalesTotal ?? 0;
            } else {
              dailySalesReportObj.businessPaymentMethods.push({
                paymentMethodType: payment.paymentMethodType,
                methodBranch: payment.methodBranch,
                methodSalesTotal: payment.methodSalesTotal ?? 0,
              });
            }
          });
        }

        dailySalesReportObj.dailyTotalSalesBeforeAdjustments +=
          row.totalSalesBeforeAdjustments ?? 0;
        dailySalesReportObj.dailyNetPaidAmount += row.totalNetPaidAmount ?? 0;
        dailySalesReportObj.dailyTipsReceived += row.totalTipsReceived ?? 0;
        dailySalesReportObj.dailyCostOfGoodsSold += row.totalCostOfGoodsSold ?? 0;
        dailySalesReportObj.dailyCustomersServed += row.totalCustomersServed ?? 0;

        row.soldGoods?.forEach((businessGood) =>
          mergeGoods(businessGoodsReport.goodsSold, businessGood),
        );
        row.voidedGoods?.forEach((businessGood) =>
          mergeGoods(businessGoodsReport.goodsVoid, businessGood),
        );
        row.invitedGoods?.forEach((businessGood) =>
          mergeGoods(businessGoodsReport.goodsInvited, businessGood),
        );
      };

      (dailyReportWithUsers.employeesDailySalesReport ?? []).forEach((row) =>
        aggregateActorRow(row),
      );

      if (Array.isArray(dailyReportWithUsers.selfOrderingSalesReport)) {
        dailyReportWithUsers.selfOrderingSalesReport.forEach((selfOrderRow) => {
          aggregateActorRow(selfOrderRow);
        });
      }

      if (dailyReportWithUsers.deliveryDailySalesReport) {
        aggregateActorRow(dailyReportWithUsers.deliveryDailySalesReport);
      }

      dailySalesReportObj.dailyProfit =
        dailySalesReportObj.dailyNetPaidAmount -
        dailySalesReportObj.dailyCostOfGoodsSold;

      dailySalesReportObj.dailyAverageCustomerExpenditure =
        dailySalesReportObj.dailyCustomersServed > 0
          ? dailySalesReportObj.dailyNetPaidAmount /
            dailySalesReportObj.dailyCustomersServed
          : 0;

      dailySalesReportObj.dailySoldGoods = businessGoodsReport.goodsSold;
      dailySalesReportObj.dailyVoidedGoods = businessGoodsReport.goodsVoid;
      dailySalesReportObj.dailyInvitedGoods = businessGoodsReport.goodsInvited;

      dailySalesReportObj.dailyTotalVoidValue =
        dailySalesReportObj.dailyVoidedGoods.reduce(
          (acc, curr) => acc + (curr.totalPrice ?? 0),
          0,
        );

      dailySalesReportObj.dailyTotalInvitedValue =
        dailySalesReportObj.dailyInvitedGoods.reduce(
          (acc, curr) => acc + (curr.totalPrice ?? 0),
          0,
        );

      const businessIdPayload = dailyReportWithUsers.businessId;
      const subscription =
        typeof businessIdPayload === "object" &&
        businessIdPayload !== null &&
        "subscription" in businessIdPayload
          ? (businessIdPayload as { subscription?: string }).subscription
          : undefined;

      const comissionPercentage = resolveBaseCommissionPercent(subscription);

      dailySalesReportObj.dailyPosSystemCommission =
        dailySalesReportObj.dailyTotalSalesBeforeAdjustments *
        comissionPercentage;

      if (isAggregateMismatchCheckEnabled()) {
        recordAggregateMismatchCheck(
          hasAggregateMismatch(dailySalesReport, dailySalesReportObj),
          {
            route: "calculateBusinessReport",
            dailySalesReportId,
            businessId: String(businessId),
          },
        );
      }

      await DailySalesReport.updateOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
        dailySalesReportObj,
      );

      const businessIdForMonthly =
        typeof dailyReportWithUsers.businessId === "object" &&
        dailyReportWithUsers.businessId !== null
          ? ((dailyReportWithUsers.businessId as { _id?: Types.ObjectId })
              ._id ?? (dailyReportWithUsers.businessId as Types.ObjectId))
          : new Types.ObjectId(String(dailyReportWithUsers.businessId));

      const weeklyReportStartDay =
        typeof dailyReportWithUsers.businessId === "object" &&
        dailyReportWithUsers.businessId !== null &&
        "reportingConfig" in dailyReportWithUsers.businessId
          ? (dailyReportWithUsers.businessId as {
              reportingConfig?: { weeklyReportStartDay?: number };
            }).reportingConfig?.weeklyReportStartDay ?? 1
          : 1;

      const rollupRefresh = await refreshWeeklyAndMonthlyReports(
        businessIdForMonthly,
        new Date(),
        weeklyReportStartDay,
        "calculateBusinessReport",
      );

      return reply.code(200).send({
        message: "Daily sales report updated",
        rollupRefresh,
      });
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/calculateUsersReport - reconciliation-only per-user rebuild
  app.patch<{ Params: DailySalesReportIdParams; Body: CalculateUsersReportBody }>(
    "/:dailySalesReportId/calculateUsersReport",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: dailySalesReportIdParamsSchema,
        body: calculateUsersReportBodySchema,
      },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { dailySalesReportId } = req.params;
      const { userIds } = req.body;

      const dailySalesReport = (await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
      )
        .select("dailyReferenceNumber businessId")
        .lean()) as Pick<IDailySalesReport, "dailyReferenceNumber"> | null;

      if (!dailySalesReport) {
        throw notFound("Daily sales report not found!");
      }
      const reportBusinessId =
        typeof (dailySalesReport as IDailySalesReport).businessId === "object" &&
        (dailySalesReport as IDailySalesReport).businessId !== null &&
        "_id" in (dailySalesReport as IDailySalesReport).businessId
          ? ((dailySalesReport as IDailySalesReport).businessId as {
              _id: Types.ObjectId;
            })._id
          : ((dailySalesReport as IDailySalesReport).businessId as Types.ObjectId);
      if (String(reportBusinessId) !== String(managerBusinessId)) {
        throw forbidden("Forbidden");
      }

      const result = await reconcileEmployeesDailySalesReport(
        userIds.map((id) => new Types.ObjectId(id)),
        dailySalesReport.dailyReferenceNumber,
      );

      // 207 Multi-Status is a success-class (2xx) response reporting partial
      // success, so it carries the per-user results rather than problem details.
      if (result.errors && result.errors.length > 0) {
        return reply.code(207).send({
          message: "Some errors occurred while updating employees!",
          errors: result.errors,
        });
      }

      return reply.code(200).send(result.updatedEmployees);
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/close - close report
  app.patch<{ Params: DailySalesReportIdParams }>(
    "/:dailySalesReportId/close",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: dailySalesReportIdParamsSchema },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { dailySalesReportId } = req.params;

      const dailyReport = (await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
      )
        .select(
          "dailyReferenceNumber businessId dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue",
        )
        .lean()) as IDailySalesReport | null;

      if (!dailyReport) {
        throw notFound("Daily sales report not found!");
      }

      const businessId =
        typeof dailyReport.businessId === "object" &&
        dailyReport.businessId !== null &&
        "_id" in dailyReport.businessId
          ? (dailyReport.businessId as { _id: Types.ObjectId })._id
          : (dailyReport.businessId as Types.ObjectId);
      if (String(businessId) !== String(managerBusinessId)) {
        throw forbidden("You are not allowed to close the daily sales report!");
      }

      const openOrdersExist = await Order.exists({
        businessId: managerBusinessId,
        billingStatus: "Open",
        dailyReferenceNumber: dailyReport.dailyReferenceNumber,
      });

      if (openOrdersExist) {
        throw badRequest(
          "You can't close the daily sales because there are open orders!",
        );
      }

      const dailyReportWithUsers = (await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
      )
        .select(
          "_id dailyReferenceNumber employeesDailySalesReport deliveryDailySalesReport selfOrderingSalesReport businessId",
        )
        .populate({
          path: "businessId",
          select: "subscription reportingConfig.weeklyReportStartDay",
          model: Business,
        })
        .lean()) as {
        _id: Types.ObjectId;
        dailyReferenceNumber: number;
        businessId:
          | {
              _id: Types.ObjectId;
              subscription?: string;
              reportingConfig?: { weeklyReportStartDay?: number };
            }
          | Types.ObjectId;
        employeesDailySalesReport?: IActorDailySalesReport[];
        deliveryDailySalesReport?: IActorDailySalesReport;
        selfOrderingSalesReport?: IActorDailySalesReport[];
      } | null;

      if (!dailyReportWithUsers) {
        throw notFound("Daily report not found!");
      }

      const businessGoodsReport = {
        goodsSold: [] as IGoodsReduced[],
        goodsVoid: [] as IGoodsReduced[],
        goodsInvited: [] as IGoodsReduced[],
      };

      const dailySalesReportObj = {
        businessPaymentMethods: [] as IPaymentMethod[],
        dailyTotalSalesBeforeAdjustments: 0,
        dailyNetPaidAmount: 0,
        dailyTipsReceived: 0,
        dailyCostOfGoodsSold: 0,
        dailyProfit: 0,
        dailyCustomersServed: 0,
        dailyAverageCustomerExpenditure: 0,
        dailySoldGoods: [] as IGoodsReduced[],
        dailyVoidedGoods: [] as IGoodsReduced[],
        dailyInvitedGoods: [] as IGoodsReduced[],
        dailyTotalVoidValue: 0,
        dailyTotalInvitedValue: 0,
        dailyPosSystemCommission: 0,
      };

      const mergeGoods = (array: IGoodsReduced[], businessGood: IGoodsReduced) => {
        const existingGood = array.find(
          (item) =>
            (item.businessGoodId as Types.ObjectId)?.toString() ===
            (businessGood.businessGoodId as Types.ObjectId)?.toString(),
        );

        if (existingGood) {
          existingGood.quantity += businessGood.quantity ?? 1;
          existingGood.totalPrice =
            (existingGood.totalPrice ?? 0) + (businessGood.totalPrice ?? 0);
          existingGood.totalCostPrice =
            (existingGood.totalCostPrice ?? 0) +
            (businessGood.totalCostPrice ?? 0);
          return;
        }

        array.push({
          businessGoodId: businessGood.businessGoodId,
          quantity: businessGood.quantity ?? 1,
          totalPrice: businessGood.totalPrice ?? 0,
          totalCostPrice: businessGood.totalCostPrice ?? 0,
        });
      };

      const aggregateActorRow = (row: IActorDailySalesReport | undefined) => {
        if (!row) return;

        if (row.employeePaymentMethods) {
          row.employeePaymentMethods.forEach((payment: IPaymentMethod) => {
            const existingPayment = dailySalesReportObj.businessPaymentMethods.find(
              (p: IPaymentMethod) =>
                p.paymentMethodType === payment.paymentMethodType &&
                p.methodBranch === payment.methodBranch,
            );

            if (existingPayment) {
              existingPayment.methodSalesTotal += payment.methodSalesTotal ?? 0;
            } else {
              dailySalesReportObj.businessPaymentMethods.push({
                paymentMethodType: payment.paymentMethodType,
                methodBranch: payment.methodBranch,
                methodSalesTotal: payment.methodSalesTotal ?? 0,
              });
            }
          });
        }

        dailySalesReportObj.dailyTotalSalesBeforeAdjustments +=
          row.totalSalesBeforeAdjustments ?? 0;
        dailySalesReportObj.dailyNetPaidAmount += row.totalNetPaidAmount ?? 0;
        dailySalesReportObj.dailyTipsReceived += row.totalTipsReceived ?? 0;
        dailySalesReportObj.dailyCostOfGoodsSold += row.totalCostOfGoodsSold ?? 0;
        dailySalesReportObj.dailyCustomersServed += row.totalCustomersServed ?? 0;

        row.soldGoods?.forEach((businessGood) =>
          mergeGoods(businessGoodsReport.goodsSold, businessGood),
        );
        row.voidedGoods?.forEach((businessGood) =>
          mergeGoods(businessGoodsReport.goodsVoid, businessGood),
        );
        row.invitedGoods?.forEach((businessGood) =>
          mergeGoods(businessGoodsReport.goodsInvited, businessGood),
        );
      };

      (dailyReportWithUsers.employeesDailySalesReport ?? []).forEach((row) =>
        aggregateActorRow(row),
      );
      if (dailyReportWithUsers.deliveryDailySalesReport) {
        aggregateActorRow(dailyReportWithUsers.deliveryDailySalesReport);
      }
      (dailyReportWithUsers.selfOrderingSalesReport ?? []).forEach((row) =>
        aggregateActorRow(row),
      );

      dailySalesReportObj.dailyProfit =
        dailySalesReportObj.dailyNetPaidAmount -
        dailySalesReportObj.dailyCostOfGoodsSold;
      dailySalesReportObj.dailyAverageCustomerExpenditure =
        dailySalesReportObj.dailyCustomersServed > 0
          ? dailySalesReportObj.dailyNetPaidAmount /
            dailySalesReportObj.dailyCustomersServed
          : 0;
      dailySalesReportObj.dailySoldGoods = businessGoodsReport.goodsSold;
      dailySalesReportObj.dailyVoidedGoods = businessGoodsReport.goodsVoid;
      dailySalesReportObj.dailyInvitedGoods = businessGoodsReport.goodsInvited;
      dailySalesReportObj.dailyTotalVoidValue =
        dailySalesReportObj.dailyVoidedGoods.reduce(
          (acc, curr) => acc + (curr.totalPrice ?? 0),
          0,
        );
      dailySalesReportObj.dailyTotalInvitedValue =
        dailySalesReportObj.dailyInvitedGoods.reduce(
          (acc, curr) => acc + (curr.totalPrice ?? 0),
          0,
        );

      const businessIdPayload = dailyReportWithUsers.businessId;
      const subscription =
        typeof businessIdPayload === "object" &&
        businessIdPayload !== null &&
        "subscription" in businessIdPayload
          ? (businessIdPayload as { subscription?: string }).subscription
          : undefined;
      const comissionPercentage = resolveBaseCommissionPercent(subscription);
      dailySalesReportObj.dailyPosSystemCommission =
        dailySalesReportObj.dailyTotalSalesBeforeAdjustments *
        comissionPercentage;

      if (isAggregateMismatchCheckEnabled()) {
        recordAggregateMismatchCheck(
          hasAggregateMismatch(
            {
              dailyTotalSalesBeforeAdjustments:
                dailyReport.dailyTotalSalesBeforeAdjustments,
              dailyNetPaidAmount: dailyReport.dailyNetPaidAmount,
              dailyCostOfGoodsSold: dailyReport.dailyCostOfGoodsSold,
              dailyTipsReceived: dailyReport.dailyTipsReceived,
              dailyTotalVoidValue: dailyReport.dailyTotalVoidValue,
              dailyTotalInvitedValue: dailyReport.dailyTotalInvitedValue,
            },
            dailySalesReportObj,
          ),
          {
            route: "closeDailyReport",
            dailySalesReportId,
            businessId: String(managerBusinessId),
          },
        );
      }

      const updatedReport = await DailySalesReport.updateOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
        { $set: { ...dailySalesReportObj, isDailyReportOpen: false } },
      );

      if (updatedReport.matchedCount === 0) {
        throw internal("Failed to close the daily sales report!");
      }

      const businessIdForRollups =
        typeof dailyReportWithUsers.businessId === "object" &&
        dailyReportWithUsers.businessId !== null
          ? ((dailyReportWithUsers.businessId as { _id?: Types.ObjectId })
              ._id ?? (dailyReportWithUsers.businessId as Types.ObjectId))
          : new Types.ObjectId(String(dailyReportWithUsers.businessId));

      const weeklyReportStartDay =
        typeof dailyReportWithUsers.businessId === "object" &&
        dailyReportWithUsers.businessId !== null &&
        "reportingConfig" in dailyReportWithUsers.businessId
          ? (dailyReportWithUsers.businessId as {
              reportingConfig?: { weeklyReportStartDay?: number };
            }).reportingConfig?.weeklyReportStartDay ?? 1
          : 1;

      if (updatedReport.modifiedCount === 0) {
        app.log.info(
          {
            dailySalesReportId,
            businessId: String(businessIdForRollups),
          },
          "daily sales report close is idempotent no-op (already closed)",
        );
      }

      const rollupRefresh = await refreshWeeklyAndMonthlyReports(
        businessIdForRollups,
        new Date(),
        weeklyReportStartDay,
        "closeDailyReport",
      );

      return reply.code(200).send({
        message: "Daily sales report closed successfully",
        rollupRefresh,
      });
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/reconcile - manual/admin reconciliation safety-net
  // Rebuilds actor rows + top-level totals from source orders.
  // This endpoint is intentionally separate from normal calculate flow.
  // Uses shared reconciliation core (not runtime incremental path).
  app.patch<{ Params: DailySalesReportIdParams }>(
    "/:dailySalesReportId/reconcile",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: dailySalesReportIdParamsSchema },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { dailySalesReportId } = req.params;

      const report = (await DailySalesReport.findOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
      )
        .select("businessId dailyReferenceNumber")
        .lean()) as
        | {
            businessId: Types.ObjectId | { _id: Types.ObjectId };
            dailyReferenceNumber: number;
          }
        | null;

      if (!report) {
        throw notFound("Daily report not found!");
      }

      const reportBusinessId =
        typeof report.businessId === "object" &&
        report.businessId !== null &&
        "_id" in report.businessId
          ? (report.businessId as { _id: Types.ObjectId })._id
          : (report.businessId as Types.ObjectId);

      if (String(reportBusinessId) !== String(managerBusinessId)) {
        throw forbidden("Forbidden");
      }

      const reconciledPayload = await buildReconciledDailyReportPayload(
        report.dailyReferenceNumber,
        reportBusinessId,
      );

      const result = await DailySalesReport.updateOne(
        withSoftDeleteFilter({ _id: dailySalesReportId }),
        { $set: reconciledPayload },
      );

      if (result.modifiedCount === 0) {
        throw internal("Reconciliation did not modify the report.");
      }

      return reply.code(200).send({
        message: "Daily report reconciled from source orders successfully.",
      });
    },
  );

  // GET /dailySalesReports/business/:businessId - get by business
  app.get<{
    Params: DailySalesReportsBusinessParams;
    Querystring: DailySalesReportsBusinessQuery;
  }>(
    "/business/:businessId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: dailySalesReportsBusinessParamsSchema,
        querystring: dailySalesReportsBusinessQuerySchema,
      },
    },
    async (req, reply) => {
      const managerBusinessId = await resolveManagerBusinessId(req);
      const { businessId } = req.params;
      if (String(managerBusinessId) !== String(businessId)) {
        throw forbidden("Forbidden");
      }

      const {
        startDate,
        endDate,
        dailyReferenceNumber,
        dailyReferenceNumberFrom,
        dailyReferenceNumberTo,
        includeDeleted = false,
      } = req.query;

      const filter: {
        businessId: Types.ObjectId;
        dailyReferenceNumber?: number | { $gte?: number; $lte?: number };
        createdAt?: { $gte?: Date; $lte?: Date };
      } = { businessId: new Types.ObjectId(businessId) };

      // Operational-day filtering for business-facing reporting.
      if (dailyReferenceNumber !== undefined) {
        filter.dailyReferenceNumber = dailyReferenceNumber;
      } else if (
        dailyReferenceNumberFrom !== undefined ||
        dailyReferenceNumberTo !== undefined
      ) {
        const range: { $gte?: number; $lte?: number } = {};

        if (dailyReferenceNumberFrom !== undefined) {
          range.$gte = dailyReferenceNumberFrom;
        }
        if (dailyReferenceNumberTo !== undefined) {
          range.$lte = dailyReferenceNumberTo;
        }

        if (
          range.$gte !== undefined &&
          range.$lte !== undefined &&
          range.$gte > range.$lte
        ) {
          throw badRequest(
            "Invalid dailyReferenceNumber range, from must be <= to!",
          );
        }

        filter.dailyReferenceNumber = range;
      }

      if (startDate !== undefined && endDate !== undefined) {
        if (startDate > endDate) {
          throw badRequest(
            "Invalid date range, start date must be before end date!",
          );
        }

        // Resolve each date-only filter to its business-local day bounds,
        // using the business's own timezone (falling back to UTC for a missing
        // or invalid zone). The resolver is server-timezone independent.
        const business = (await Business.findById(businessId)
          .select("timezone")
          .lean()) as { timezone?: string } | null;
        const storedTimezone = business?.timezone;
        const timeZone = isSupportedTimezone(storedTimezone)
          ? storedTimezone
          : "UTC";

        filter.createdAt = {
          $gte: resolveDayBounds(startDate, timeZone).start,
          $lte: resolveDayBounds(endDate, timeZone).end,
        };
      }

      const dailySalesReports = await DailySalesReport.find(
        withSoftDeleteFilter(filter as unknown as Record<string, unknown>, includeDeleted),
      )
        .populate({
          path: "employeesDailySalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .populate({
          path: "deliveryDailySalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .populate({
          path: "selfOrderingSalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .lean();

      if (!dailySalesReports.length) {
        throw notFound("No daily reports found!");
      }
      return reply.code(200).send(dailySalesReports);
    },
  );
};
