import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type {
  IActorDailySalesReport,
  IGoodsReduced,
  IDailySalesReport,
} from "../../../../packages/interfaces/IDailySalesReport.ts";
import type { IPaymentMethod } from "../../../../packages/interfaces/IPaymentMethod.ts";
import type { IEmployee } from "../../../../packages/interfaces/IEmployee.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
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
import { createAuthHook } from "../../auth/middleware.ts";
import { isAggregateMismatchCheckEnabled } from "../../dailySalesReports/rolloutControls.ts";
import { recordAggregateMismatchCheck } from "../../dailySalesReports/rolloutTelemetry.ts";
import { buildReconciledDailyPayload } from "../../dailySalesReports/reconciliationCore.ts";
import * as enums from "../../../../packages/enums.ts";

const { managementRolesEnums } = enums;

export const dailySalesReportsRoutes: FastifyPluginAsync = async (app) => {
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

  const resolveManagerBusinessId = async (
    req: { authSession?: { type: string; id: string } },
  ): Promise<
    | { businessId: Types.ObjectId }
    | { errorCode: number; message: string }
  > => {
    if (!req.authSession || req.authSession.type !== "user") {
      return { errorCode: 401, message: "Unauthorized" };
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
      return { errorCode: 403, message: "Forbidden" };
    }

    const businessId =
      typeof employeeDoc.businessId === "object" &&
      employeeDoc.businessId !== null &&
      "_id" in employeeDoc.businessId
        ? (employeeDoc.businessId as { _id: Types.ObjectId })._id
        : new Types.ObjectId(String(employeeDoc.businessId));

    return { businessId };
  };

  // GET /dailySalesReports - list all
  app.get(
    "/",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
    try {
      const managerContext = await resolveManagerBusinessId(req);
      if ("errorCode" in managerContext) {
        return reply
          .code(managerContext.errorCode)
          .send({ message: managerContext.message });
      }

      const dailySalesReports = await DailySalesReport.find({
        businessId: managerContext.businessId,
      })
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
        return reply.code(404).send({ message: "No daily reports found!" });
      }
      return reply.code(200).send(dailySalesReports);
    } catch (error) {
      return reply.code(500).send({
        message: "Get daily sales reports tables failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );

  // GET /dailySalesReports/:dailySalesReportId - get by ID
  app.get(
    "/:dailySalesReportId",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
    try {
      const managerContext = await resolveManagerBusinessId(req);
      if ("errorCode" in managerContext) {
        return reply
          .code(managerContext.errorCode)
          .send({ message: managerContext.message });
      }

      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      if (
        !dailySalesReportId ||
        isObjectIdValid([dailySalesReportId]) !== true
      ) {
        return reply.code(400).send({ message: "Invalid daily report ID!" });
      }

      const dailySalesReport = await DailySalesReport.findById(
        dailySalesReportId,
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
        return reply.code(404).send({ message: "Daily report not found!" });
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
        String(reportBusinessId) !== String(managerContext.businessId)
      ) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      return reply.code(200).send(dailySalesReport);
    } catch (error) {
      return reply.code(500).send({
        message: "Get daily sales report by its id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );

  // DELETE /dailySalesReports/:dailySalesReportId - delete
  app.delete(
    "/:dailySalesReportId",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return reply.code(403).send({
          message:
            "Hard delete of financial reports is disabled in production.",
        });
      }

      const managerContext = await resolveManagerBusinessId(req);
      if ("errorCode" in managerContext) {
        return reply
          .code(managerContext.errorCode)
          .send({ message: managerContext.message });
      }

      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      if (
        !dailySalesReportId ||
        isObjectIdValid([dailySalesReportId]) !== true
      ) {
        return reply.code(400).send({ message: "Invalid daily report ID!" });
      }

      const result = await DailySalesReport.deleteOne({
        _id: dailySalesReportId,
        businessId: managerContext.businessId,
      });

      if (result.deletedCount === 0) {
        return reply.code(404).send({ message: "Daily report not found!" });
      }

      return reply.code(200).send(`Daily report ${dailySalesReportId} deleted`);
    } catch (error) {
      return reply.code(500).send({
        message: "Delete daily sales report failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/calculateBusinessReport - calculate business report
  app.patch(
    "/:dailySalesReportId/calculateBusinessReport",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      try {
        const managerContext = await resolveManagerBusinessId(req);
        if ("errorCode" in managerContext) {
          return reply
            .code(managerContext.errorCode)
            .send({ message: managerContext.message });
        }

        const params = req.params as { dailySalesReportId?: string };
        const dailySalesReportId = params.dailySalesReportId;

        if (
          !dailySalesReportId ||
          isObjectIdValid([dailySalesReportId]) !== true
        ) {
          return reply
            .code(400)
            .send({ message: "Invalid dailySalesReport ID!" });
        }

        const dailySalesReport = (await DailySalesReport.findOne({
          _id: dailySalesReportId,
        })
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
          return reply.code(400).send({ message: "Daily report not found!" });
        }

        const businessId =
          typeof dailySalesReport.businessId === "object" &&
          dailySalesReport.businessId !== null &&
          "_id" in dailySalesReport.businessId
            ? (dailySalesReport.businessId as { _id: Types.ObjectId })._id
            : (dailySalesReport.businessId as Types.ObjectId);
        if (String(businessId) !== String(managerContext.businessId)) {
          return reply.code(403).send({
            message: "You are not allowed to calculate the daily sales report!",
          });
        }

        const dailyReportWithUsers = (await DailySalesReport.findOne({
          _id: dailySalesReportId,
        })
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
          return reply.code(400).send({ message: "Daily report not found!" });
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

        if (false) {
          // Keep explicit partial-failure contract visible for future non-blocking
          // downstream integrations that may return mixed success.
          return reply.code(207).send({
            message: "Some non-critical aggregation steps failed.",
          });
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
        dailySalesReportObj.dailyInvitedGoods =
          businessGoodsReport.goodsInvited;

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

        let comissionPercentage = 0;
        const businessIdPayload = dailyReportWithUsers.businessId;
        const subscription =
          typeof businessIdPayload === "object" &&
          businessIdPayload !== null &&
          "subscription" in businessIdPayload
            ? (businessIdPayload as { subscription?: string }).subscription
            : undefined;

        switch (subscription) {
          case "Free":
            comissionPercentage = 0;
            break;
          case "Basic":
            comissionPercentage = 0.05;
            break;
          case "Premium":
            comissionPercentage = 0.08;
            break;
          case "Enterprise":
            comissionPercentage = 0.1;
            break;
          default:
            comissionPercentage = 0;
            break;
        }

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
          { _id: dailySalesReportId },
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

        aggregateDailyReportsIntoWeekly(
          businessIdForMonthly,
          new Date(),
          weeklyReportStartDay,
        ).catch((err) => {
          app.log.error("aggregateDailyReportsIntoWeekly failed:", err);
        });

        aggregateDailyReportsIntoMonthly(businessIdForMonthly).catch((err) => {
          app.log.error("aggregateDailyReportsIntoMonthly failed:", err);
        });

        return reply.code(200).send({ message: "Daily sales report updated" });
      } catch (error) {
        return reply.code(500).send({
          message: "Failed to update daily sales report!",
          error: error instanceof Error ? error.message : error,
        });
      }
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/calculateUsersReport - reconciliation-only per-user rebuild
  app.patch(
    "/:dailySalesReportId/calculateUsersReport",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
    try {
      const managerContext = await resolveManagerBusinessId(req);
      if ("errorCode" in managerContext) {
        return reply
          .code(managerContext.errorCode)
          .send({ message: managerContext.message });
      }

      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      const { userIds } = req.body as { userIds?: string[] };

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return reply.code(400).send({
          message: "User IDs must be a non-empty array!",
        });
      }

      if (
        !dailySalesReportId ||
        isObjectIdValid([dailySalesReportId, ...userIds]) !== true
      ) {
        return reply.code(400).send({
          message: "Invalid dailySalesReport or user ID!",
        });
      }

      const dailySalesReport = (await DailySalesReport.findById(
        dailySalesReportId,
      )
        .select("dailyReferenceNumber businessId")
        .lean()) as Pick<IDailySalesReport, "dailyReferenceNumber"> | null;

      if (!dailySalesReport) {
        return reply
          .code(404)
          .send({ message: "Daily sales report not found!" });
      }
      const reportBusinessId =
        typeof (dailySalesReport as IDailySalesReport).businessId === "object" &&
        (dailySalesReport as IDailySalesReport).businessId !== null &&
        "_id" in (dailySalesReport as IDailySalesReport).businessId
          ? ((dailySalesReport as IDailySalesReport).businessId as {
              _id: Types.ObjectId;
            })._id
          : ((dailySalesReport as IDailySalesReport).businessId as Types.ObjectId);
      if (String(reportBusinessId) !== String(managerContext.businessId)) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const result = await reconcileEmployeesDailySalesReport(
        userIds.map((id) => new Types.ObjectId(id)),
        dailySalesReport.dailyReferenceNumber,
      );

      if (result.errors && result.errors.length > 0) {
        return reply.code(207).send({
          message: "Some errors occurred while updating employees!",
          errors: result.errors,
        });
      }

      return reply.code(200).send(result.updatedEmployees);
    } catch (error) {
      return reply.code(500).send({
        message: "Get daily sales report by employee id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/close - close report
  app.patch(
    "/:dailySalesReportId/close",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      try {
        const managerContext = await resolveManagerBusinessId(req);
        if ("errorCode" in managerContext) {
          return reply
            .code(managerContext.errorCode)
            .send({ message: managerContext.message });
        }

        const params = req.params as { dailySalesReportId?: string };
        const dailySalesReportId = params.dailySalesReportId;

        if (
          !dailySalesReportId ||
          isObjectIdValid([dailySalesReportId]) !== true
        ) {
          return reply
            .code(400)
            .send({ message: "Invalid dailySalesReport ID!" });
        }

        const dailyReport = (await DailySalesReport.findById(dailySalesReportId)
          .select(
            "dailyReferenceNumber businessId dailyTotalSalesBeforeAdjustments dailyNetPaidAmount dailyCostOfGoodsSold dailyTipsReceived dailyTotalVoidValue dailyTotalInvitedValue",
          )
          .lean()) as IDailySalesReport | null;

        if (!dailyReport) {
          return reply
            .code(404)
            .send({ message: "Daily sales report not found!" });
        }

        const businessId =
          typeof dailyReport.businessId === "object" &&
          dailyReport.businessId !== null &&
          "_id" in dailyReport.businessId
            ? (dailyReport.businessId as { _id: Types.ObjectId })._id
            : (dailyReport.businessId as Types.ObjectId);
        if (String(businessId) !== String(managerContext.businessId)) {
          return reply.code(403).send({
            message: "You are not allowed to close the daily sales report!",
          });
        }

        const openOrdersExist = await Order.exists({
          businessId: managerContext.businessId,
          billingStatus: "Open",
          dailyReferenceNumber: dailyReport.dailyReferenceNumber,
        });

        if (openOrdersExist) {
          return reply.code(400).send({
            message:
              "You can't close the daily sales because there are open orders!",
          });
        }

        const dailyReportWithUsers = (await DailySalesReport.findOne({
          _id: dailySalesReportId,
        })
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
          return reply.code(404).send({ message: "Daily report not found!" });
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

        let comissionPercentage = 0;
        const businessIdPayload = dailyReportWithUsers.businessId;
        const subscription =
          typeof businessIdPayload === "object" &&
          businessIdPayload !== null &&
          "subscription" in businessIdPayload
            ? (businessIdPayload as { subscription?: string }).subscription
            : undefined;
        switch (subscription) {
          case "Free":
            comissionPercentage = 0;
            break;
          case "Basic":
            comissionPercentage = 0.05;
            break;
          case "Premium":
            comissionPercentage = 0.08;
            break;
          case "Enterprise":
            comissionPercentage = 0.1;
            break;
          default:
            comissionPercentage = 0;
            break;
        }
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
              businessId: String(managerContext.businessId),
            },
          );
        }

        const updatedReport = await DailySalesReport.updateOne(
          { _id: dailySalesReportId },
          { $set: { ...dailySalesReportObj, isDailyReportOpen: false } },
        );

        if (updatedReport.modifiedCount === 0) {
          return reply.code(500).send({
            message: "Failed to close the daily sales report!",
          });
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

        aggregateDailyReportsIntoWeekly(
          businessIdForRollups,
          new Date(),
          weeklyReportStartDay,
        ).catch((err) => {
          app.log.error(
            "aggregateDailyReportsIntoWeekly failed on close:",
            err,
          );
        });

        aggregateDailyReportsIntoMonthly(businessIdForRollups).catch((err) => {
          app.log.error("aggregateDailyReportsIntoMonthly failed on close:", err);
        });

        return reply.code(200).send({
          message: "Daily sales report closed successfully",
        });
      } catch (error) {
        return reply.code(500).send({
          message: "Failed to close daily sales report!",
          error: error instanceof Error ? error.message : error,
        });
      }
    },
  );

  // PATCH /dailySalesReports/:dailySalesReportId/reconcile - manual/admin reconciliation safety-net
  // Rebuilds actor rows + top-level totals from source orders.
  // This endpoint is intentionally separate from normal calculate flow.
  // Uses shared reconciliation core (not runtime incremental path).
  app.patch(
    "/:dailySalesReportId/reconcile",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      try {
        const managerContext = await resolveManagerBusinessId(req);
        if ("errorCode" in managerContext) {
          return reply
            .code(managerContext.errorCode)
            .send({ message: managerContext.message });
        }

        const params = req.params as { dailySalesReportId?: string };
        const dailySalesReportId = params.dailySalesReportId;
        if (
          !dailySalesReportId ||
          isObjectIdValid([dailySalesReportId]) !== true
        ) {
          return reply
            .code(400)
            .send({ message: "Invalid dailySalesReport ID!" });
        }

        const report = (await DailySalesReport.findById(dailySalesReportId)
          .select("businessId dailyReferenceNumber")
          .lean()) as
          | {
              businessId: Types.ObjectId | { _id: Types.ObjectId };
              dailyReferenceNumber: number;
            }
          | null;

        if (!report) {
          return reply.code(404).send({ message: "Daily report not found!" });
        }

        const reportBusinessId =
          typeof report.businessId === "object" &&
          report.businessId !== null &&
          "_id" in report.businessId
            ? (report.businessId as { _id: Types.ObjectId })._id
            : (report.businessId as Types.ObjectId);

        if (String(reportBusinessId) !== String(managerContext.businessId)) {
          return reply.code(403).send({ message: "Forbidden" });
        }

        const reconciledPayload = await buildReconciledDailyReportPayload(
          report.dailyReferenceNumber,
          reportBusinessId,
        );

        const result = await DailySalesReport.updateOne(
          { _id: dailySalesReportId },
          { $set: reconciledPayload },
        );

        if (result.modifiedCount === 0) {
          return reply.code(500).send({
            message: "Reconciliation did not modify the report.",
          });
        }

        return reply.code(200).send({
          message:
            "Daily report reconciled from source orders successfully.",
        });
      } catch (error) {
        return reply.code(500).send({
          message: "Failed to reconcile daily sales report!",
          error: error instanceof Error ? error.message : error,
        });
      }
    },
  );

  // GET /dailySalesReports/business/:businessId - get by business
  app.get(
    "/business/:businessId",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
    try {
      const managerContext = await resolveManagerBusinessId(req);
      if ("errorCode" in managerContext) {
        return reply
          .code(managerContext.errorCode)
          .send({ message: managerContext.message });
      }

      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid business ID!" });
      }
      if (String(managerContext.businessId) !== String(businessId)) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const query = req.query as { startDate?: string; endDate?: string };
      const startDate = query.startDate;
      const endDate = query.endDate;
      const queryWithOperationalDay = req.query as {
        startDate?: string;
        endDate?: string;
        dailyReferenceNumber?: string;
        dailyReferenceNumberFrom?: string;
        dailyReferenceNumberTo?: string;
      };
      const dailyReferenceNumberRaw =
        queryWithOperationalDay.dailyReferenceNumber;
      const dailyReferenceNumberFromRaw =
        queryWithOperationalDay.dailyReferenceNumberFrom;
      const dailyReferenceNumberToRaw =
        queryWithOperationalDay.dailyReferenceNumberTo;

      const startOfDay = startDate
        ? new Date(startDate.split("T")[0] + "T00:00:00.000Z")
        : null;

      const endOfDay = endDate
        ? new Date(endDate.split("T")[0] + "T23:59:59.999Z")
        : null;

      const filter: {
        businessId: Types.ObjectId;
        dailyReferenceNumber?: number | { $gte?: number; $lte?: number };
        createdAt?: { $gte?: Date | null; $lte?: Date | null };
      } = { businessId: new Types.ObjectId(businessId) };

      // Operational-day filtering for business-facing reporting.
      if (dailyReferenceNumberRaw !== undefined) {
        const dailyReferenceNumber = Number(dailyReferenceNumberRaw);
        if (!Number.isInteger(dailyReferenceNumber)) {
          return reply.code(400).send({
            message: "dailyReferenceNumber must be an integer!",
          });
        }
        filter.dailyReferenceNumber = dailyReferenceNumber;
      } else if (
        dailyReferenceNumberFromRaw !== undefined ||
        dailyReferenceNumberToRaw !== undefined
      ) {
        const range: { $gte?: number; $lte?: number } = {};

        if (dailyReferenceNumberFromRaw !== undefined) {
          const from = Number(dailyReferenceNumberFromRaw);
          if (!Number.isInteger(from)) {
            return reply.code(400).send({
              message: "dailyReferenceNumberFrom must be an integer!",
            });
          }
          range.$gte = from;
        }

        if (dailyReferenceNumberToRaw !== undefined) {
          const to = Number(dailyReferenceNumberToRaw);
          if (!Number.isInteger(to)) {
            return reply.code(400).send({
              message: "dailyReferenceNumberTo must be an integer!",
            });
          }
          range.$lte = to;
        }

        if (
          range.$gte !== undefined &&
          range.$lte !== undefined &&
          range.$gte > range.$lte
        ) {
          return reply.code(400).send({
            message:
              "Invalid dailyReferenceNumber range, from must be <= to!",
          });
        }

        filter.dailyReferenceNumber = range;
      }

      if (startDate && endDate) {
        if (startDate > endDate) {
          return reply.code(400).send({
            message: "Invalid date range, start date must be before end date!",
          });
        }
        filter.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
      }

      const dailySalesReports = await DailySalesReport.find(filter)
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
        return reply.code(404).send({ message: "No daily reports found!" });
      }
      return reply.code(200).send(dailySalesReports);
    } catch (error) {
      return reply.code(500).send({
        message: "Get daily sales report by business id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );
};
