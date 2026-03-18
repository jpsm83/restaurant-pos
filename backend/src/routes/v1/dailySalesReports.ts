import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IGoodsReduced, IDailySalesReport } from "@shared/interfaces/IDailySalesReport";
import type { IPaymentMethod } from "@shared/interfaces/IPaymentMethod";
import type { IEmployee } from "@shared/interfaces/IEmployee";

import { isObjectIdValid } from "../../utils/isObjectIdValid.js";
import { updateEmployeesDailySalesReport } from "../../dailySalesReports/updateEmployeeDailySalesReport.js";
import { DELIVERY_ATTRIBUTION_USER_ID, MANAGEMENT_ROLES } from "../../utils/constants.js";
import { aggregateDailyReportsIntoMonthly } from "../../monthlyBusinessReport/aggregateDailyReportsIntoMonthly.js";
import DailySalesReport from "../../models/dailySalesReport.js";
import User from "../../models/user.js";
import Employee from "../../models/employee.js";
import Business from "../../models/business.js";
import Order from "../../models/order.js";
import { createAuthHook } from "../../auth/middleware.js";

export const dailySalesReportsRoutes: FastifyPluginAsync = async (app) => {
  // GET /dailySalesReports - list all
  app.get("/", async (_req, reply) => {
    try {
      const dailySalesReports = await DailySalesReport.find()
        .populate({
          path: "employeesDailySalesReport.userId",
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
  });

  // GET /dailySalesReports/:dailySalesReportId - get by ID
  app.get("/:dailySalesReportId", async (req, reply) => {
    try {
      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      if (!dailySalesReportId || isObjectIdValid([dailySalesReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid daily report ID!" });
      }

      const dailySalesReport = await DailySalesReport.findById(dailySalesReportId)
        .populate({
          path: "employeesDailySalesReport.userId",
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
      return reply.code(200).send(dailySalesReport);
    } catch (error) {
      return reply.code(500).send({
        message: "Get daily sales report by its id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /dailySalesReports/:dailySalesReportId - delete
  app.delete("/:dailySalesReportId", async (req, reply) => {
    try {
      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      if (!dailySalesReportId || isObjectIdValid([dailySalesReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid daily report ID!" });
      }

      const result = await DailySalesReport.deleteOne({
        _id: dailySalesReportId,
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
  });

  // PATCH /dailySalesReports/:dailySalesReportId/calculateBusinessReport - calculate business report
  app.patch("/:dailySalesReportId/calculateBusinessReport", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    try {
      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const userObjectId = new Types.ObjectId(req.authSession.id);

      if (!dailySalesReportId || isObjectIdValid([dailySalesReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid dailySalesReport ID!" });
      }

      const dailySalesReport = (await DailySalesReport.findOne({
        _id: dailySalesReportId,
      })
        .select("dailyReferenceNumber businessId")
        .lean()) as {
        dailyReferenceNumber: number;
        businessId: Types.ObjectId | { _id: Types.ObjectId };
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

      const employeeRoleOnDuty = (await Employee.findOne({
        userId: userObjectId,
        businessId,
      })
        .select("currentShiftRole")
        .lean()) as IEmployee | null;

      if (
        !employeeRoleOnDuty ||
        !MANAGEMENT_ROLES.includes(employeeRoleOnDuty.currentShiftRole ?? "")
      ) {
        return reply.code(403).send({
          message: "You are not allowed to calculate the daily sales report!",
        });
      }

      const dailyReportWithUsers = await DailySalesReport.findOne({
        _id: dailySalesReportId,
      })
        .select(
          "_id dailyReferenceNumber employeesDailySalesReport.userId employeesDailySalesReport.hasOpenSalesInstances businessId"
        )
        .populate({
          path: "employeesDailySalesReport.userId",
          select: "personalDetails.firstName personalDetails.lastName",
          model: User,
        })
        .populate({ path: "businessId", select: "subscription", model: Business })
        .lean() as {
        _id: Types.ObjectId;
        dailyReferenceNumber: number;
        businessId: { _id: Types.ObjectId; subscription?: string } | Types.ObjectId;
        employeesDailySalesReport: { userId: { _id: Types.ObjectId } | Types.ObjectId }[];
      } | null;

      if (!dailyReportWithUsers) {
        return reply.code(400).send({ message: "Daily report not found!" });
      }

      let userIds = dailyReportWithUsers.employeesDailySalesReport.map(
        (emp: { userId: { _id: Types.ObjectId } | Types.ObjectId }) =>
          typeof emp.userId === "object" && emp.userId !== null && "_id" in emp.userId
            ? (emp.userId as { _id: Types.ObjectId })._id
            : (emp.userId as Types.ObjectId)
      );
      if (
        !userIds.some(
          (id: Types.ObjectId) => id.toString() === DELIVERY_ATTRIBUTION_USER_ID.toString()
        )
      ) {
        userIds = [...userIds, DELIVERY_ATTRIBUTION_USER_ID];
      }

      const updatedEmployeesDailySalesReport = await updateEmployeesDailySalesReport(
        userIds,
        dailyReportWithUsers.dailyReferenceNumber
      );

      if (updatedEmployeesDailySalesReport.errors.length > 0) {
        return reply.code(207).send({
          message: "Some errors occurred while updating employees!",
          errors: updatedEmployeesDailySalesReport.errors,
        });
      }

      const businessGoodsReport: {
        goodsSold: IGoodsReduced[];
        goodsVoid: IGoodsReduced[];
        goodsInvited: IGoodsReduced[];
      } = {
        goodsSold: [],
        goodsVoid: [],
        goodsInvited: [],
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

      if (Array.isArray(updatedEmployeesDailySalesReport.updatedEmployees)) {
        updatedEmployeesDailySalesReport.updatedEmployees.forEach(
          (employeeReport) => {
            if (employeeReport.employeePaymentMethods) {
              employeeReport.employeePaymentMethods.forEach(
                (payment: IPaymentMethod) => {
                  const existingPayment =
                    dailySalesReportObj.businessPaymentMethods.find(
                      (p: IPaymentMethod) =>
                        p.paymentMethodType === payment.paymentMethodType &&
                        p.methodBranch === payment.methodBranch
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
                }
              );
            }

            dailySalesReportObj.dailyTotalSalesBeforeAdjustments +=
              employeeReport.totalSalesBeforeAdjustments ?? 0;
            dailySalesReportObj.dailyNetPaidAmount +=
              employeeReport.totalNetPaidAmount ?? 0;
            dailySalesReportObj.dailyTipsReceived +=
              employeeReport.totalTipsReceived ?? 0;
            dailySalesReportObj.dailyCostOfGoodsSold +=
              employeeReport.totalCostOfGoodsSold ?? 0;
            dailySalesReportObj.dailyCustomersServed +=
              employeeReport.totalCustomersServed ?? 0;

            const updateGoodsArray = (
              array: IGoodsReduced[],
              businessGood: IGoodsReduced
            ) => {
              const existingGood = array.find(
                (item) =>
                  (item.businessGoodId as Types.ObjectId)?.toString() ===
                  (businessGood.businessGoodId as Types.ObjectId)?.toString()
              );

              if (existingGood) {
                existingGood.quantity += businessGood.quantity ?? 1;
                existingGood.totalPrice =
                  (existingGood.totalPrice ?? 0) + (businessGood.totalPrice ?? 0);
                existingGood.totalCostPrice =
                  (existingGood.totalCostPrice ?? 0) +
                  (businessGood.totalCostPrice ?? 0);
              } else {
                array.push({
                  businessGoodId: businessGood.businessGoodId,
                  quantity: businessGood.quantity ?? 1,
                  totalPrice: businessGood.totalPrice ?? 0,
                  totalCostPrice: businessGood.totalCostPrice ?? 0,
                });
              }
            };

            if (employeeReport.soldGoods && employeeReport.soldGoods.length > 0) {
              employeeReport.soldGoods.forEach((businessGood: IGoodsReduced) => {
                updateGoodsArray(businessGoodsReport.goodsSold, businessGood);
              });
            }

            if (
              employeeReport.voidedGoods &&
              employeeReport.voidedGoods.length > 0
            ) {
              employeeReport.voidedGoods.forEach((businessGood: IGoodsReduced) => {
                updateGoodsArray(businessGoodsReport.goodsVoid, businessGood);
              });
            }

            if (
              employeeReport.invitedGoods &&
              employeeReport.invitedGoods.length > 0
            ) {
              employeeReport.invitedGoods.forEach((businessGood: IGoodsReduced) => {
                updateGoodsArray(businessGoodsReport.goodsInvited, businessGood);
              });
            }
          }
        );
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
          0
        );

      dailySalesReportObj.dailyTotalInvitedValue =
        dailySalesReportObj.dailyInvitedGoods.reduce(
          (acc, curr) => acc + (curr.totalPrice ?? 0),
          0
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
        dailySalesReportObj.dailyTotalSalesBeforeAdjustments * comissionPercentage;

      await DailySalesReport.updateOne(
        { _id: dailySalesReportId },
        dailySalesReportObj
      );

      const businessIdForMonthly =
        typeof dailyReportWithUsers.businessId === "object" &&
        dailyReportWithUsers.businessId !== null
          ? ((dailyReportWithUsers.businessId as { _id?: Types.ObjectId })._id ??
              (dailyReportWithUsers.businessId as Types.ObjectId))
          : new Types.ObjectId(String(dailyReportWithUsers.businessId));

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
  });

  // PATCH /dailySalesReports/:dailySalesReportId/calculateUsersReport - calculate users report
  app.patch("/:dailySalesReportId/calculateUsersReport", async (req, reply) => {
    try {
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

      const dailySalesReport = (await DailySalesReport.findById(dailySalesReportId)
        .select("dailyReferenceNumber")
        .lean()) as Pick<IDailySalesReport, "dailyReferenceNumber"> | null;

      if (!dailySalesReport) {
        return reply.code(404).send({ message: "Daily sales report not found!" });
      }

      const result = await updateEmployeesDailySalesReport(
        userIds.map((id) => new Types.ObjectId(id)),
        dailySalesReport.dailyReferenceNumber
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
  });

  // PATCH /dailySalesReports/:dailySalesReportId/close - close report
  app.patch("/:dailySalesReportId/close", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    try {
      const params = req.params as { dailySalesReportId?: string };
      const dailySalesReportId = params.dailySalesReportId;

      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const userObjectId = new Types.ObjectId(req.authSession.id);

      if (!dailySalesReportId || isObjectIdValid([dailySalesReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid dailySalesReport ID!" });
      }

      const dailyReport = (await DailySalesReport.findById(dailySalesReportId)
        .select("dailyReferenceNumber businessId")
        .lean()) as IDailySalesReport | null;

      if (!dailyReport) {
        return reply.code(404).send({ message: "Daily sales report not found!" });
      }

      const businessId =
        typeof dailyReport.businessId === "object" &&
        dailyReport.businessId !== null &&
        "_id" in dailyReport.businessId
          ? (dailyReport.businessId as { _id: Types.ObjectId })._id
          : (dailyReport.businessId as Types.ObjectId);

      const employeeDoc = (await Employee.findOne({
        userId: userObjectId,
        businessId,
      })
        .select("currentShiftRole businessId")
        .lean()) as IEmployee | null;

      if (
        !employeeDoc ||
        !MANAGEMENT_ROLES.includes(employeeDoc.currentShiftRole ?? "")
      ) {
        return reply.code(403).send({
          message: "You are not allowed to close the daily sales report!",
        });
      }

      const openOrdersExist = await Order.exists({
        businessId: employeeDoc.businessId,
        billingStatus: "Open",
        dailyReferenceNumber: dailyReport.dailyReferenceNumber,
      });

      if (openOrdersExist) {
        return reply.code(400).send({
          message:
            "You can't close the daily sales because there are open orders!",
        });
      }

      const updatedReport = await DailySalesReport.updateOne(
        { _id: dailySalesReportId },
        { $set: { isDailyReportOpen: false } }
      );

      if (updatedReport.modifiedCount === 0) {
        return reply.code(500).send({
          message: "Failed to close the daily sales report!",
        });
      }

      return reply.code(200).send({
        message: "Daily sales report closed successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Failed to close daily sales report!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /dailySalesReports/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid business ID!" });
      }

      const query = req.query as { startDate?: string; endDate?: string };
      const startDate = query.startDate;
      const endDate = query.endDate;

      const startOfDay = startDate
        ? new Date(startDate.split("T")[0] + "T00:00:00.000Z")
        : null;

      const endOfDay = endDate
        ? new Date(endDate.split("T")[0] + "T23:59:59.999Z")
        : null;

      const filter: {
        businessId: Types.ObjectId;
        createdAt?: { $gte?: Date | null; $lte?: Date | null };
      } = { businessId: new Types.ObjectId(businessId) };

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
  });
};
