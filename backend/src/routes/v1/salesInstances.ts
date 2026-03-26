import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  IDailySalesReport,
} from "../../../../packages/interfaces/IDailySalesReport.ts";
import type { ISalesInstance } from "../../../../packages/interfaces/ISalesInstance.ts";
import type { IPaymentMethod } from "../../../../packages/interfaces/IPaymentMethod.ts";
import type { IOrder } from "../../../../packages/interfaces/IOrder.ts";
import type { IAddress } from "../../../../packages/interfaces/IAddress.ts";
import type { IBusiness } from "../../../../packages/interfaces/IBusiness.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import SalesInstance from "../../models/salesInstance.ts";
import SalesPoint from "../../models/salesPoint.ts";
import User from "../../models/user.ts";
import Order from "../../models/order.ts";
import BusinessGood from "../../models/businessGood.ts";
import Employee from "../../models/employee.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import Reservation from "../../models/reservation.ts";
import Business from "../../models/business.ts";
import createDailySalesReport from "../../dailySalesReports/createDailySalesReport.ts";
import createSalesInstance from "../../salesInstances/createSalesInstance.ts";
import {
  runEmployeeSalesInstanceTxn,
  type EmployeeSalesTxnResult,
} from "../../salesInstances/runEmployeeSalesInstanceTxn.ts";
import { isTransientMongoClusterError } from "../../mongo/transientClusterError.ts";
import {
  pointBusyForCustomerSelfOrder,
  pointBusyForEmployee,
} from "../../salesInstances/salesInstanceConflicts.ts";
import cancelOrders from "../../orders/cancelOrders.ts";
import closeOrders from "../../orders/closeOrders.ts";
import finalizeOrdersBillingStatus from "../../orders/finalizeOrdersBillingStatus.ts";
import validatePaymentMethodArray from "../../orders/validatePaymentMethodArray.ts";
import ordersArrValidation from "../../orders/ordersArrValidation.ts";
import createOrders from "../../orders/createOrders.ts";
import applyPromotionsToOrders from "../../promotions/applyPromotions.ts";
import checkLowStockAndNotify from "../../inventories/checkLowStockAndNotify.ts";
import sendOrderConfirmation from "../../orderConfirmation/sendOrderConfirmation.ts";
import {
  createAuthHook,
  createOptionalAuthHook,
} from "../../auth/middleware.ts";
import transferOrdersBetweenSalesInstances from "../../orders/transferOrdersBetweenSalesInstances.ts";
import getEffectiveUserRoleAtTime from "../../auth/getEffectiveUserRoleAtTime.ts";
import {
  isBusinessOpenNow,
  isDeliveryOpenNow,
} from "../../business/isBusinessOpenNow.ts";
import * as enums from "../../../../packages/enums.ts";

const { managementRolesEnums } = enums;

export const salesInstancesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_req, reply) => {
    const salesInstances = await SalesInstance.find()
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
        model: Order,
      })
      .lean();

    if (!salesInstances?.length) {
      return reply.code(404).send({ message: "No salesInstances found!" });
    }
    return reply.code(200).send(salesInstances);
  });

  app.post(
    "/",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const openedByUserId = new Types.ObjectId(req.authSession.id);

      const body = req.body as Partial<ISalesInstance>;
      const {
        salesPointId,
        guests,
        salesInstanceStatus,
        businessId,
        clientName,
      } = body ?? {};

      if (!salesPointId || !guests || !businessId) {
        return reply.code(400).send({
          message: "SalesPointId, guests and businessId are required!",
        });
      }

      if (isObjectIdValid([salesPointId as any, businessId as any]) !== true) {
        return reply
          .code(400)
          .send({ message: "SalesPointId or businessId not valid!" });
      }

      const effectiveRole = await getEffectiveUserRoleAtTime({
        userId: openedByUserId,
        businessId: businessId as Types.ObjectId,
      });
      if (effectiveRole !== "employee") {
        return reply.code(403).send({
          message:
            "You must be an on-duty employee to open a table from the POS.",
        });
      }

      const salesPointExists = await SalesPoint.exists({
        _id: salesPointId,
        businessId: businessId as Types.ObjectId,
      });
      if (!salesPointExists) {
        return reply.code(404).send({
          message:
            "Sales point does not belong to this business (or does not exist)!",
        });
      }

      const outcome = await runEmployeeSalesInstanceTxn(async (session) => {
        const dailySalesReport = (await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId: businessId as Types.ObjectId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean()) as unknown as IDailySalesReport | null;

        const dailyReferenceNumber = dailySalesReport
          ? (dailySalesReport as any).dailyReferenceNumber
          : await createDailySalesReport(businessId as any, session);

        if (typeof dailyReferenceNumber === "string") {
          if (isTransientMongoClusterError(dailyReferenceNumber)) {
            throw new Error(dailyReferenceNumber);
          }
          return {
            kind: "response" as const,
            status: 400,
            body: { message: dailyReferenceNumber },
          };
        }

        const existingOpen = await pointBusyForEmployee({
          salesPointId: salesPointId as unknown as Types.ObjectId,
          businessId: businessId as unknown as Types.ObjectId,
          session,
        });

        if (existingOpen) {
          return {
            kind: "response" as const,
            status: 409,
            body: {
              message: "SalesInstance already exists and it is not closed!",
            },
          };
        }

        const newSalesInstanceObj: ISalesInstance = {
          dailyReferenceNumber: dailyReferenceNumber as any,
          salesPointId: salesPointId as any,
          guests: guests as any,
          salesInstanceStatus: (salesInstanceStatus as any) ?? "Occupied",
          openedByUserId: openedByUserId as any,
          openedAsRole: "employee",
          businessId: businessId as any,
          clientName: clientName as any,
        } as ISalesInstance;

        const result = await createSalesInstance(newSalesInstanceObj, session);
        if (typeof result === "string") {
          if (isTransientMongoClusterError(result)) {
            throw new Error(result);
          }
          return {
            kind: "response" as const,
            status: 400,
            body: { message: result },
          };
        }

        return { kind: "committed" as const };
      });

      if (outcome.kind === "response") {
        return reply.code(outcome.status).send(outcome.body);
      }
      return reply
        .code(201)
        .send({ message: "SalesInstance created successfully!" });
    },
  );

  app.get("/:salesInstanceId", async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    if (!salesInstanceId || isObjectIdValid([salesInstanceId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesInstanceId!" });
    }

    const salesInstance = await SalesInstance.findById(salesInstanceId)
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
        model: Order,
      })
      .lean();

    if (!salesInstance) {
      return reply.code(404).send({ message: "SalesLocation not found!" });
    }

    return reply.code(200).send(salesInstance);
  });

  app.patch(
    "/:salesInstanceId",
    { preValidation: [createOptionalAuthHook(app)] },
    async (req, reply) => {
      const params = req.params as { salesInstanceId?: string };
      const salesInstanceId = params.salesInstanceId;

      const sessionUserId =
        req.authSession?.type === "user"
          ? new Types.ObjectId(req.authSession.id)
          : null;

      const body = req.body as {
        ordersIdsArr?: string[];
        discountPercentage?: number;
        comments?: string;
        cancel?: boolean;
        ordersNewBillingStatus?: string;
        voidReason?: string;
        ordersNewStatus?: string;
        paymentMethodArr?: IPaymentMethod[];
        toSalesInstanceId?: string;
        guests?: number;
        salesInstanceStatus?: string;
        responsibleByUserId?: string;
        clientName?: string;
      };

      const {
        ordersIdsArr,
        cancel,
        ordersNewBillingStatus,
        paymentMethodArr,
        toSalesInstanceId,
        guests,
        salesInstanceStatus,
        responsibleByUserId,
        clientName,
      } = body;

      const idsToValidate: (string | Types.ObjectId)[] = [salesInstanceId!];
      if (responsibleByUserId) idsToValidate.push(responsibleByUserId);
      if (ordersIdsArr) idsToValidate.push(...ordersIdsArr);
      if (toSalesInstanceId) idsToValidate.push(toSalesInstanceId);

      if (isObjectIdValid(idsToValidate as Types.ObjectId[]) !== true) {
        return reply.code(400).send({ message: "Invalid IDs!" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const salesInstance = (await SalesInstance.findById(salesInstanceId)
          .select(
            "openedByUserId businessId salesInstanceStatus salesGroup openedAsRole salesPointId"
          )
          .session(session)
          .lean()) as unknown as ISalesInstance | null;

        if (!salesInstance) {
          await session.abortTransaction();
          return reply.code(404).send({ message: "SalesInstance not found!" });
        }

        const wantsCancel = Boolean(cancel && ordersIdsArr && ordersIdsArr.length > 0);
        const wantsCloseWithPayment = Boolean(
          paymentMethodArr && ordersIdsArr && ordersIdsArr.length > 0,
        );
        const wantsTransferOrders = Boolean(
          toSalesInstanceId && ordersIdsArr && ordersIdsArr.length > 0,
        );
        const wantsFinalizeWithoutPayment = Boolean(
          ordersNewBillingStatus &&
            ordersIdsArr &&
            ordersIdsArr.length > 0 &&
            (ordersNewBillingStatus === "Void" ||
              ordersNewBillingStatus === "Invitation"),
        );
        const wantsAnyRestrictedOperation =
          wantsCancel ||
          wantsCloseWithPayment ||
          wantsTransferOrders ||
          wantsFinalizeWithoutPayment;

        // Carve-out (idea doc §4/§E): customer-open/delivery/self-order sessions must not use these PATCH operations.
        if (wantsAnyRestrictedOperation && salesInstance.openedAsRole !== "employee") {
          await session.abortTransaction();
          return reply.code(409).send({
            message:
              'Operation not allowed: only employee-open SalesInstances can be cancelled, closed with payment, or have orders transferred via this endpoint.',
          });
        }

        // Idea doc §4: close/transfer/cancel should require an auth session.
        if (wantsAnyRestrictedOperation && !sessionUserId) {
          await session.abortTransaction();
          return reply.code(401).send({
            message:
              "Unauthorized; authenticated employee session is required for this operation.",
          });
        }

        // Task 5 (idea doc): order-to-salesInstance integrity.
        // Ensure that:
        // - close/cancel operations touch orders that belong to the receiver (patched SalesInstance)
        // - transfer operations touch orders that belong to the source (toSalesInstanceId)
        if (wantsAnyRestrictedOperation && ordersIdsArr && ordersIdsArr.length > 0) {
          const uniqueOrderIds = new Set(ordersIdsArr);
          if (uniqueOrderIds.size !== ordersIdsArr.length) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: "Invalid ordersIdsArr: duplicates are not allowed.",
            });
          }

          const orderObjectIds = ordersIdsArr.map((id) => new Types.ObjectId(id));

          // Receiver-transfer contract:
          // PATCH /:salesInstanceId is the receiver instance.
          // Body `toSalesInstanceId` is the source instance (current owner of the orders).
          const ordersOwnerSalesInstanceId = wantsTransferOrders
            ? new Types.ObjectId(toSalesInstanceId!)
            : new Types.ObjectId(salesInstanceId);

          if (wantsTransferOrders) {
            const sourceSalesInstance = await SalesInstance.findById(
              toSalesInstanceId,
            )
              .select("businessId salesInstanceStatus openedAsRole")
              .session(session)
              .lean();

            if (!sourceSalesInstance) {
              await session.abortTransaction();
              return reply.code(404).send({
                message:
                  "Source salesInstance not found for transfer (toSalesInstanceId).",
              });
            }

            if (
              sourceSalesInstance.businessId.toString() !==
              salesInstance.businessId.toString()
            ) {
              await session.abortTransaction();
              return reply.code(400).send({
                message:
                  "Source and receiver salesInstances must belong to the same business.",
              });
            }

            if (sourceSalesInstance.openedAsRole !== "employee") {
              await session.abortTransaction();
              return reply.code(409).send({
                message:
                  "Operation not allowed: can only transfer orders from an employee-open SalesInstance.",
              });
            }

            if (sourceSalesInstance.salesInstanceStatus === "Closed") {
              await session.abortTransaction();
              return reply.code(409).send({
                message:
                  "Operation not allowed: can not transfer from a closed source SalesInstance.",
              });
            }
          }

          const orders = (await Order.find({
            _id: { $in: orderObjectIds },
            salesInstanceId: ordersOwnerSalesInstanceId,
            businessId: salesInstance.businessId,
          })
            .select("_id billingStatus orderStatus")
            .session(session)
            .lean()) as unknown as Array<{
            _id: Types.ObjectId;
            billingStatus: string;
            orderStatus: string;
          }>;

          if (!orders || orders.length !== ordersIdsArr.length) {
            await session.abortTransaction();
            return reply.code(404).send({
              message:
                "Some orders do not belong to this SalesInstance (or its business).",
            });
          }

          // Idea doc §4/§E: close/cancel/transfer should operate only on Open billing orders.
          if (orders.some((o) => o.billingStatus !== "Open")) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: "Only orders with billingStatus 'Open' can be closed, cancelled, or transferred.",
            });
          }

          // Cancel-specific rule: do not allow cancelling orders already completed in the order flow.
          if (wantsCancel && orders.some((o) => o.orderStatus === "Done")) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: "Cannot cancel orders with orderStatus 'Done'!",
            });
          }
        }

        if (
          salesInstance.salesInstanceStatus === "Occupied" &&
          (!salesInstance.salesGroup ||
            salesInstance.salesGroup.length === 0) &&
          salesInstanceStatus !== "Reserved"
        ) {
          const deleteResult = await SalesInstance.deleteOne(
            { _id: salesInstanceId },
            { session },
          );

          if (deleteResult.deletedCount === 0) {
            await session.abortTransaction();
            return reply
              .code(404)
              .send({ message: "Empty salesInstance not deleted!" });
          }
        }

        if (responsibleByUserId && !sessionUserId) {
          await session.abortTransaction();
          return reply
            .code(401)
            .send({ message: "Unauthorized to set responsible user" });
        }

        if (cancel && ordersIdsArr && ordersIdsArr.length > 0) {
          if (!sessionUserId) {
            await session.abortTransaction();
            return reply.code(401).send({
              message:
                "Unauthorized; userId from session is required to cancel orders!",
            });
          }
          const cancelEmployee = (await Employee.findOne({
            userId: sessionUserId,
            businessId: salesInstance.businessId,
          })
            .select("allEmployeeRoles")
            .session(session)
            .lean()) as { allEmployeeRoles?: string[] } | null;

          if (
            !cancelEmployee ||
            !managementRolesEnums.some((role) =>
              cancelEmployee.allEmployeeRoles?.includes(role),
            )
          ) {
            await session.abortTransaction();
            return reply.code(403).send({
              message: "Only on-duty management roles can cancel orders!",
            });
          }

          const cancelOrdersResult = await cancelOrders(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            new Types.ObjectId(salesInstanceId),
            session,
          );

          if (cancelOrdersResult !== true) {
            await session.abortTransaction();
            return reply.code(400).send({ message: cancelOrdersResult });
          }
        }

        if (wantsFinalizeWithoutPayment && ordersIdsArr && ordersIdsArr.length > 0) {
          if (!sessionUserId) {
            await session.abortTransaction();
            return reply.code(401).send({
              message:
                "Unauthorized; authenticated management session is required to finalize orders as Void/Invitation.",
            });
          }

          const managerEmployee = (await Employee.findOne({
            userId: sessionUserId,
            businessId: salesInstance.businessId,
          })
            .select("allEmployeeRoles")
            .session(session)
            .lean()) as { allEmployeeRoles?: string[] } | null;

          if (
            !managerEmployee ||
            !managementRolesEnums.some((role) =>
              managerEmployee.allEmployeeRoles?.includes(role),
            )
          ) {
            await session.abortTransaction();
            return reply.code(403).send({
              message:
                "Only management roles can finalize orders as Void/Invitation.",
            });
          }

          const status = ordersNewBillingStatus as "Void" | "Invitation";
          const finalizeResult = await finalizeOrdersBillingStatus(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            new Types.ObjectId(salesInstanceId),
            status,
            session,
          );

          if (finalizeResult !== true) {
            await session.abortTransaction();
            return reply.code(400).send({ message: finalizeResult });
          }
        }

        if (paymentMethodArr && ordersIdsArr && ordersIdsArr.length > 0) {
          const validPaymentMethods =
            validatePaymentMethodArray(paymentMethodArr);
          if (validPaymentMethods !== true) {
            await session.abortTransaction();
            return reply.code(400).send({ message: validPaymentMethods });
          }

          const closeOrdersResult = await closeOrders(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            paymentMethodArr,
            new Types.ObjectId(salesInstanceId),
            session,
          );

          if (closeOrdersResult !== true) {
            await session.abortTransaction();
            return reply.code(400).send({ message: closeOrdersResult });
          }
        }

        if (toSalesInstanceId && ordersIdsArr && ordersIdsArr.length > 0) {
          const transferResult = await transferOrdersBetweenSalesInstances(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            // From source (orders owner) -> to receiver (patched SalesInstance)
            new Types.ObjectId(toSalesInstanceId),
            new Types.ObjectId(salesInstanceId),
            salesInstance.businessId,
            session,
          );

          if (transferResult !== true) {
            await session.abortTransaction();
            return reply.code(400).send({ message: transferResult });
          }
        }

        const updatedSalesInstanceObj: Partial<ISalesInstance> = {};

        if (guests) updatedSalesInstanceObj.guests = guests;
        if (salesInstanceStatus)
          updatedSalesInstanceObj.salesInstanceStatus =
            salesInstanceStatus as ISalesInstance["salesInstanceStatus"];
        if (clientName) updatedSalesInstanceObj.clientName = clientName;
        if (responsibleByUserId)
          updatedSalesInstanceObj.responsibleByUserId = new Types.ObjectId(
            responsibleByUserId,
          ) as any;

        const updatedSalesInstance = await SalesInstance.updateOne(
          { _id: salesInstanceId },
          { $set: updatedSalesInstanceObj },
          { session },
        );

        if (
          updatedSalesInstance.modifiedCount === 0 &&
          Object.keys(updatedSalesInstanceObj).length > 0
        ) {
          await session.abortTransaction();
          return reply.code(404).send({ message: "SalesInstance not found!" });
        }

        await session.commitTransaction();

        return reply
          .code(200)
          .send({ message: "SalesInstance updated successfully!" });
      } catch (error) {
        await session.abortTransaction();
        return reply.code(500).send({
          message: "Update salesInstance failed!",
          error: error instanceof Error ? error.message : error,
        });
      } finally {
        session.endSession();
      }
    },
  );

  app.delete("/:salesInstanceId", async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    if (!salesInstanceId || isObjectIdValid([salesInstanceId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesInstanceId" });
    }

    const result = await SalesInstance.deleteOne({
      _id: salesInstanceId,
      $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }],
    });

    if (result.deletedCount === 0) {
      return reply.code(404).send({
        message: "Sales instance not found or it has orders!",
      });
    }

    return reply
      .code(200)
      .send({ message: "Sales instance deleted successfully!" });
  });

  app.patch(
    "/:salesInstanceId/transferSalesPoint",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      const params = req.params as { salesInstanceId?: string };
      const salesInstanceId = params.salesInstanceId;

      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const sessionUserId = new Types.ObjectId(req.authSession.id);

      const body = req.body as { salesPointId?: string };
      const { salesPointId } = body;

      if (!salesPointId) {
        return reply.code(400).send({ message: "salesPointId is required!" });
      }

      if (isObjectIdValid([salesInstanceId!, salesPointId]) !== true) {
        return reply.code(400).send({ message: "Invalid IDs!" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const salesInstance = (await SalesInstance.findById(salesInstanceId)
          .select(
            "businessId dailyReferenceNumber salesInstanceStatus salesPointId reservationId openedAsRole",
          )
          .session(session)
          .lean()) as unknown as {
          _id: Types.ObjectId;
          businessId: Types.ObjectId;
          dailyReferenceNumber: number;
          salesInstanceStatus: string;
          salesPointId: Types.ObjectId;
          openedAsRole: string;
          reservationId?: Types.ObjectId;
        } | null;

        if (!salesInstance) {
          await session.abortTransaction();
          return reply.code(404).send({ message: "SalesInstance not found!" });
        }

        if (salesInstance.salesInstanceStatus === "Closed") {
          await session.abortTransaction();
          return reply.code(409).send({ message: "SalesInstance is closed!" });
        }

        if (salesInstance.openedAsRole !== "employee") {
          await session.abortTransaction();
          return reply.code(409).send({
            message:
              "Operation not allowed: only employee-open SalesInstances can be transferred between sales points via this endpoint.",
          });
        }

        const employee = (await Employee.findOne({
          userId: sessionUserId,
          businessId: salesInstance.businessId,
        })
          .select("allEmployeeRoles")
          .session(session)
          .lean()) as unknown as { allEmployeeRoles?: string[] } | null;

        const isAllowed =
          (employee?.allEmployeeRoles || []).includes("Host") ||
          managementRolesEnums.some((role) =>
            employee?.allEmployeeRoles?.includes(role),
          );

        if (!isAllowed) {
          await session.abortTransaction();
          return reply.code(403).send({ message: "Forbidden" });
        }

        const sp = await SalesPoint.exists({
          _id: salesPointId,
          businessId: salesInstance.businessId,
        }).session(session);

        if (!sp) {
          await session.abortTransaction();
          return reply
            .code(404)
            .send({ message: "SalesPoint not found for this business!" });
        }

        const openConflict = await pointBusyForEmployee({
          salesPointId: new Types.ObjectId(salesPointId),
          businessId: salesInstance.businessId,
          session,
          excludeSalesInstanceId: new Types.ObjectId(salesInstanceId),
        });

        if (openConflict) {
          await session.abortTransaction();
          return reply.code(409).send({
            message:
              "Cannot move to this salesPoint because it already has an open SalesInstance!",
          });
        }

        const moved = await SalesInstance.updateOne(
          { _id: salesInstanceId },
          { $set: { salesPointId } },
          { session },
        );

        if (moved.modifiedCount !== 1) {
          await session.abortTransaction();
          return reply.code(400).send({ message: "SalesInstance not moved!" });
        }

        const reservation = (await Reservation.findOne({
          $or: [
            { salesInstanceId: salesInstanceId },
            { _id: salesInstance.reservationId },
          ],
        })
          .select("_id status")
          .session(session)
          .lean()) as { _id: Types.ObjectId; status?: string } | null;

        if (reservation) {
          await Reservation.updateOne(
            { _id: reservation._id },
            { $set: { salesPointId } },
            { session },
          );
        }

        await session.commitTransaction();
        return reply
          .code(200)
          .send({ message: "SalesInstance transferred successfully!" });
      } catch (error) {
        await session.abortTransaction();
        return reply.code(500).send({
          message: "Transfer SalesInstance salesPoint failed!",
          error: error instanceof Error ? error.message : error,
        });
      } finally {
        session.endSession();
      }
    },
  );

  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesInstanceId!" });
    }

    const salesInstances = await SalesInstance.find({ businessId })
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
        model: Order,
      })
      .lean();

    if (!salesInstances.length) {
      return reply.code(404).send({ message: "No salesInstances found!" });
    }

    return reply.code(200).send(salesInstances);
  });

  app.get("/user/:userId", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || isObjectIdValid([userId]) !== true) {
      return reply.code(400).send({ message: "Invalid userId!" });
    }

    const salesInstances = await SalesInstance.find({
      $or: [{ openedByUserId: userId }, { responsibleByUserId: userId }],
    })
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
        model: Order,
      })
      .lean();

    if (!salesInstances.length) {
      return reply.code(404).send({ message: "No salesInstances found!" });
    }

    return reply.code(200).send(salesInstances);
  });

  app.post(
    "/selfOrderingLocation/:selfOrderingLocationId/openTable",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      const params = req.params as { selfOrderingLocationId?: string };
      const selfOrderingLocationId = params.selfOrderingLocationId;

      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const openedByUserId = new Types.ObjectId(req.authSession.id);

      const body = req.body as { businessId?: string; guests?: number };
      const businessId = body?.businessId;
      const guests = body?.guests ?? 1;

      if (!businessId) {
        return reply.code(400).send({ message: "businessId is required" });
      }

      if (isObjectIdValid([selfOrderingLocationId!, businessId]) !== true) {
        return reply
          .code(400)
          .send({ message: "Invalid selfOrderingLocationId or businessId" });
      }

      const salesPoint = (await SalesPoint.findById(selfOrderingLocationId)
        .select("businessId")
        .lean()) as {
        businessId: Types.ObjectId | { _id: Types.ObjectId };
      } | null;

      if (!salesPoint) {
        return reply.code(404).send({ message: "Sales point not found" });
      }

      const salesPointBusinessId =
        typeof salesPoint.businessId === "object" &&
        salesPoint.businessId !== null &&
        "_id" in salesPoint.businessId
          ? (salesPoint.businessId as { _id: Types.ObjectId })._id
          : (salesPoint.businessId as Types.ObjectId);

      if (salesPointBusinessId.toString() !== businessId.toString()) {
        return reply
          .code(400)
          .send({ message: "Sales point does not belong to this business" });
      }

      const effectiveRole = await getEffectiveUserRoleAtTime({
        userId: openedByUserId,
        businessId: new Types.ObjectId(businessId),
      });
      if (effectiveRole !== "employee") {
        return reply.code(403).send({
          message: "Employee must be on duty to open a table from QR",
        });
      }

      type OpenTableTxnOutcome = Extract<
        EmployeeSalesTxnResult,
        { kind: "response" } | { kind: "created" }
      >;

      const openOutcome = (await runEmployeeSalesInstanceTxn(async (session) => {
        const dailySalesReport = (await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean()) as unknown as
          | (Pick<IDailySalesReport, "dailyReferenceNumber"> & {
              _id: unknown;
            })
          | null;

        const dailyReferenceNumber = dailySalesReport
          ? dailySalesReport.dailyReferenceNumber
          : await createDailySalesReport(
              new Types.ObjectId(businessId),
              session,
            );

        if (typeof dailyReferenceNumber === "string") {
          if (isTransientMongoClusterError(dailyReferenceNumber)) {
            throw new Error(dailyReferenceNumber);
          }
          return {
            kind: "response" as const,
            status: 400,
            body: { message: dailyReferenceNumber },
          };
        }

        const existingOpen = await pointBusyForEmployee({
          salesPointId: new Types.ObjectId(selfOrderingLocationId),
          businessId: new Types.ObjectId(businessId),
          session,
        });

        if (existingOpen) {
          return {
            kind: "response" as const,
            status: 409,
            body: {
              message: "SalesInstance already exists and it is not closed!",
            },
          };
        }

        const newSalesInstanceObj: ISalesInstance = {
          dailyReferenceNumber,
          salesPointId: new Types.ObjectId(selfOrderingLocationId),
          guests,
          salesInstanceStatus: "Occupied",
          openedByUserId,
          openedAsRole: "employee",
          businessId: new Types.ObjectId(businessId),
        } as ISalesInstance;

        const result = await createSalesInstance(newSalesInstanceObj, session);
        if (typeof result === "string") {
          if (isTransientMongoClusterError(result)) {
            throw new Error(result);
          }
          return {
            kind: "response" as const,
            status: 400,
            body: { message: result },
          };
        }

        return { kind: "created" as const, doc: result };
      })) as OpenTableTxnOutcome;

      if (openOutcome.kind === "response") {
        return reply.code(openOutcome.status).send(openOutcome.body);
      }
      return reply.code(201).send(openOutcome.doc);
    },
  );

  app.post(
    "/delivery",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const userId = new Types.ObjectId(req.authSession.id);

      const body = req.body as {
        businessId: Types.ObjectId;
        ordersArr: IOrder[];
        paymentMethodArr: IPaymentMethod[];
        deliveryAddress?: IAddress;
        // Stable idempotency key (front provides) for payment acceptance retries.
        paymentId?: string;
      };

      const { businessId, ordersArr, paymentMethodArr, deliveryAddress, paymentId } =
        body ?? {};

      if (!businessId || !ordersArr || !paymentMethodArr) {
        return reply.code(400).send({
          message:
            "businessId, ordersArr and paymentMethodArr are required for delivery orders!",
        });
      }

      if (!paymentId || typeof paymentId !== "string") {
        return reply.code(400).send({
          message: "paymentId is required for delivery idempotency!",
        });
      }

      // Idempotency: if this payment was already accepted and processed, return the existing SalesInstance.
      const existingSalesInstanceForPayment = await SalesInstance.findOne({
        paymentId,
        businessId,
        openedAsRole: "customer",
      })
        .select("_id salesInstanceStatus")
        .lean();

      if (existingSalesInstanceForPayment?.salesInstanceStatus === "Closed") {
        const existingSalesInstanceDoc = await SalesInstance.findById(
          existingSalesInstanceForPayment._id,
        )
          .select("dailyReferenceNumber salesGroup.orderCode salesGroup.ordersIds")
          .lean();

        const paidOrders = await Order.find({
          salesInstanceId: existingSalesInstanceForPayment._id,
          billingStatus: "Paid",
        })
          .select("orderNetPrice _id")
          .lean();

        const paidOrderIds = paidOrders.map((o: any) => o._id);
        const paidOrderIdsSet = new Set(paidOrderIds.map(String));
        const totalNetPaidAmount = paidOrders.reduce(
          (acc: number, o: any) => acc + (o.orderNetPrice ?? 0),
          0,
        );

        const orderCodeForReceipt =
          existingSalesInstanceDoc?.salesGroup?.find((group: any) =>
            (group.ordersIds ?? []).some((id: any) =>
              paidOrderIdsSet.has(String(id)),
            ),
          )?.orderCode ?? existingSalesInstanceDoc?.salesGroup?.[0]?.orderCode;

        sendOrderConfirmation(userId, businessId as Types.ObjectId, {
          dailyReferenceNumber:
            existingSalesInstanceDoc?.dailyReferenceNumber ??
            (existingSalesInstanceForPayment as any).dailyReferenceNumber,
          totalNetPaidAmount,
          orderCount: paidOrders.length,
          orderCode: orderCodeForReceipt,
          flow: "delivery",
          idempotencyKey: paymentId,
        }).catch(() => {});

        return reply.code(200).send({
          message: "Delivery order already processed for this payment.",
          salesInstanceId: existingSalesInstanceForPayment._id,
        });
      }

      if (existingSalesInstanceForPayment) {
        return reply.code(409).send({
          message:
            "Delivery payment acceptance is already in progress for this paymentId.",
        });
      }

      const objectIds = [
        businessId,
        ...ordersArr.flatMap((order) => [
          order.businessGoodId!,
          ...(order.addOns ?? []),
        ]),
      ];

      if (isObjectIdValid(objectIds as Types.ObjectId[]) !== true) {
        return reply.code(400).send({
          message: "businessId or ordersArr's IDs not valid!",
        });
      }

      const ordersArrValidationResult = ordersArrValidation(ordersArr);
      if (ordersArrValidationResult !== true) {
        return reply.code(400).send({ message: ordersArrValidationResult });
      }

      const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
      if (validPaymentMethods !== true) {
        return reply.code(400).send({ message: validPaymentMethods });
      }

      const [business, user] = await Promise.all([
        Business.findById(businessId).lean(),
        User.findById(userId)
          .select(
            "address personalDetails.firstName personalDetails.lastName username",
          )
          .lean(),
      ]);

      const businessDoc = business as unknown as IBusiness | null;

      if (!businessDoc) {
        return reply.code(404).send({ message: "Business not found." });
      }

      if (!businessDoc.acceptsDelivery) {
        return reply
          .code(400)
          .send({ message: "This business does not accept delivery." });
      }

      if (!isDeliveryOpenNow(businessDoc)) {
        return reply
          .code(403)
          .send({ message: "Delivery is currently unavailable." });
      }

      if (!user) {
        return reply.code(404).send({ message: "User not found!" });
      }

      const resolvedDeliveryAddress: IAddress | undefined =
        deliveryAddress ?? (user as { address?: IAddress }).address;

      const deliverySalesPoint = (await SalesPoint.findOne({
        businessId,
        salesPointType: "delivery",
      })
        .select("_id")
        .lean()) as { _id: Types.ObjectId } | null;

      if (!deliverySalesPoint?._id) {
        return reply.code(400).send({
          message: "Delivery sales point not configured for this business.",
        });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const dailySalesReport = (await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean()) as unknown as IDailySalesReport | null;

        const clientNameSource = user as {
          personalDetails?: { firstName?: string; lastName?: string };
          username?: string;
        };
        const clientName =
          clientNameSource.personalDetails?.firstName &&
          clientNameSource.personalDetails?.lastName
            ? `${clientNameSource.personalDetails.firstName} ${clientNameSource.personalDetails.lastName}`
            : (clientNameSource.username ?? undefined);

        // payment-first contract: do not persist SalesInstance/Order until payment is valid
        // (server calculates pricing, then validates payment totals before any writes).
        let dailyReferenceNumber = dailySalesReport?.dailyReferenceNumber;

        const ordersWithPromotions = await applyPromotionsToOrders({
          businessId: businessId as Types.ObjectId,
          ordersArr: ordersArr as any,
          flow: "delivery",
          session,
        });

        if (typeof ordersWithPromotions === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: ordersWithPromotions });
        }

        const totalOrderNetPrice = (ordersWithPromotions as IOrder[]).reduce(
          (acc, o) => acc + (o.orderNetPrice ?? 0),
          0,
        );
        const totalPaid = paymentMethodArr.reduce(
          (acc, p) => acc + (p.methodSalesTotal || 0),
          0,
        );

        if (totalPaid < totalOrderNetPrice) {
          await session.abortTransaction();
          return reply.code(400).send({
            message:
              "Total amount paid is lower than the total price of the orders!",
          });
        }

        // Only now we create daily reference/report persistence (if needed) and persist SalesInstance/Orders.
        if (dailyReferenceNumber === undefined) {
          const createdDailyReferenceNumber = await createDailySalesReport(
            businessId as Types.ObjectId,
            session,
          );
          if (typeof createdDailyReferenceNumber === "string") {
            await session.abortTransaction();
            return reply.code(400).send({ message: createdDailyReferenceNumber });
          }
          dailyReferenceNumber = createdDailyReferenceNumber;
        }

        const newSalesInstanceObj: Partial<ISalesInstance> = {
          dailyReferenceNumber,
          salesPointId: deliverySalesPoint._id,
          guests: 1,
          salesInstanceStatus: "Occupied",
          openedByUserId: userId,
          openedAsRole: "customer",
          businessId: businessId as Types.ObjectId,
          clientName,
          responsibleByUserId: userId,
          paymentId,
        };

        const salesInstance = (await createSalesInstance(
          newSalesInstanceObj as ISalesInstance,
          session,
        )) as ISalesInstance | string;

        if (typeof salesInstance === "string") {
          // Race handling: if the paymentId unique index rejected the insert, return the existing instance.
          await session.abortTransaction();
          const existing = await SalesInstance.findOne({
            paymentId,
            businessId,
            openedAsRole: "customer",
          })
            .select("_id salesInstanceStatus")
            .lean();

          if (existing) {
            const existingSalesInstanceDoc = await SalesInstance.findById(
              existing._id,
            )
              .select(
                "dailyReferenceNumber salesGroup.orderCode salesGroup.ordersIds",
              )
              .lean();

            const paidOrders = await Order.find({
              salesInstanceId: existing._id,
              billingStatus: "Paid",
            })
              .select("orderNetPrice _id")
              .lean();

            const paidOrderIds = paidOrders.map((o: any) => o._id);
            const paidOrderIdsSet = new Set(paidOrderIds.map(String));
            const totalNetPaidAmount = paidOrders.reduce(
              (acc: number, o: any) => acc + (o.orderNetPrice ?? 0),
              0,
            );

            const orderCodeForReceipt =
              existingSalesInstanceDoc?.salesGroup?.find((group: any) =>
                (group.ordersIds ?? []).some((id: any) =>
                  paidOrderIdsSet.has(String(id)),
                ),
              )?.orderCode ??
              existingSalesInstanceDoc?.salesGroup?.[0]?.orderCode;

            sendOrderConfirmation(userId, businessId as Types.ObjectId, {
              dailyReferenceNumber:
                existingSalesInstanceDoc?.dailyReferenceNumber ??
                (existing as any).dailyReferenceNumber,
              totalNetPaidAmount,
              orderCount: paidOrders.length,
              orderCode: orderCodeForReceipt,
              flow: "delivery",
              idempotencyKey: paymentId,
            }).catch(() => {});

            return reply.code(200).send({
              message: "Delivery order already processed for this payment.",
              salesInstanceId: existing._id,
            });
          }

          return reply.code(400).send({ message: salesInstance });
        }

        const createdOrders = (await createOrders(
          String(dailyReferenceNumber),
          ordersWithPromotions as IOrder[],
          userId,
          "customer",
          (salesInstance as ISalesInstance)._id as Types.ObjectId,
          businessId as Types.ObjectId,
          session,
        )) as IOrder[] | string;

        if (typeof createdOrders === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: createdOrders });
        }

        const closeOrdersResult = await closeOrders(
          createdOrders.map((order) => order._id as Types.ObjectId),
          paymentMethodArr,
          salesInstance._id as Types.ObjectId,
          session,
        );

        if (typeof closeOrdersResult === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: closeOrdersResult });
        }

        await session.commitTransaction();

        checkLowStockAndNotify(businessId as Types.ObjectId).catch(() => {});

        // Idea doc §9: ensure receipts reference the correct batch `orderCode`.
        const createdOrderIds = createdOrders.map(
          (order) => order._id as Types.ObjectId,
        );
        const createdOrderIdsSet = new Set(createdOrderIds.map(String));
        const salesInstanceForOrderCode = await SalesInstance.findOne({
          _id: salesInstance._id,
          "salesGroup.ordersIds": { $in: createdOrderIds },
        })
          .select("salesGroup.orderCode salesGroup.ordersIds")
          .lean();
        const orderCodeForReceipt =
          salesInstanceForOrderCode?.salesGroup?.find((group: any) =>
            (group.ordersIds ?? []).some((id: any) =>
              createdOrderIdsSet.has(String(id)),
            ),
          )?.orderCode ?? salesInstanceForOrderCode?.salesGroup?.[0]?.orderCode;

        const totalNetPaidAmount = createdOrders.reduce(
          (acc: number, order: { orderNetPrice: number }) =>
            acc + order.orderNetPrice,
          0,
        );

        sendOrderConfirmation(userId, businessId as Types.ObjectId, {
          dailyReferenceNumber,
          totalNetPaidAmount,
          orderCount: createdOrders.length,
          orderCode: orderCodeForReceipt,
          flow: "delivery",
          clientName,
          deliveryAddress: resolvedDeliveryAddress as any,
          idempotencyKey: paymentId,
        }).catch(() => {});

        return reply.code(201).send({
          message: "Delivery order created successfully.",
          salesInstanceId: salesInstance._id,
          deliveryAddress: resolvedDeliveryAddress,
        });
      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return reply.code(500).send({
          message: "Create delivery order failed!",
          error: error instanceof Error ? error.message : error,
        });
      } finally {
        session.endSession();
      }
    },
  );

  app.post(
    "/selfOrderingLocation/:selfOrderingLocationId",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      const params = req.params as { selfOrderingLocationId?: string };
      const selfOrderingLocationId = params.selfOrderingLocationId;

      if (!req.authSession || req.authSession.type !== "user") {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      const userId = new Types.ObjectId(req.authSession.id);

      const body = req.body as Partial<ISalesInstance> & {
        ordersArr: IOrder[];
        paymentMethodArr: IPaymentMethod[];
        // Stable idempotency key (front provides) for payment acceptance retries.
        paymentId?: string;
      };

      const { businessId, ordersArr, paymentMethodArr, paymentId } = body ?? {};

      if (
        !selfOrderingLocationId ||
        !businessId ||
        !ordersArr ||
        !paymentMethodArr
      ) {
        return reply.code(400).send({
          message:
            "SelfOrderingLocationId, ordersArr, paymentMethodArr and businessId are required!",
        });
      }

      if (!paymentId || typeof paymentId !== "string") {
        return reply.code(400).send({
          message: "paymentId is required for self-order idempotency!",
        });
      }

      // Idempotency: if this payment was already accepted and processed, return the existing SalesInstance.
      const existingSalesInstanceForPayment = await SalesInstance.findOne({
        paymentId,
        businessId,
        openedAsRole: "customer",
      })
        .select("_id salesInstanceStatus")
        .lean();

      if (existingSalesInstanceForPayment?.salesInstanceStatus === "Closed") {
        const existingSalesInstanceDoc = await SalesInstance.findById(
          existingSalesInstanceForPayment._id,
        )
          .select("dailyReferenceNumber salesGroup.orderCode salesGroup.ordersIds")
          .lean();

        const paidOrders = await Order.find({
          salesInstanceId: existingSalesInstanceForPayment._id,
          billingStatus: "Paid",
        })
          .select("orderNetPrice _id")
          .lean();

        const paidOrderIds = paidOrders.map((o: any) => o._id);
        const paidOrderIdsSet = new Set(paidOrderIds.map(String));
        const totalNetPaidAmount = paidOrders.reduce(
          (acc: number, o: any) => acc + (o.orderNetPrice ?? 0),
          0,
        );

        const orderCodeForReceipt =
          existingSalesInstanceDoc?.salesGroup?.find((group: any) =>
            (group.ordersIds ?? []).some((id: any) =>
              paidOrderIdsSet.has(String(id)),
            ),
          )?.orderCode ?? existingSalesInstanceDoc?.salesGroup?.[0]?.orderCode;

        sendOrderConfirmation(userId, businessId as Types.ObjectId, {
          dailyReferenceNumber:
            existingSalesInstanceDoc?.dailyReferenceNumber ??
            (existingSalesInstanceForPayment as any).dailyReferenceNumber,
          totalNetPaidAmount,
          orderCount: paidOrders.length,
          orderCode: orderCodeForReceipt,
          flow: "selfOrder",
          idempotencyKey: paymentId,
        }).catch(() => {});

        return reply.code(200).send({
          message: "Self-order already processed for this payment.",
          salesInstanceId: existingSalesInstanceForPayment._id,
        });
      }

      if (existingSalesInstanceForPayment) {
        return reply.code(409).send({
          message:
            "Self-order payment acceptance is already in progress for this paymentId.",
        });
      }

      const objectIds = [
        ...ordersArr.flatMap((order) => [
          order.businessGoodId!,
          ...(order.addOns ?? []),
        ]),
        businessId,
        selfOrderingLocationId,
      ];

      if (isObjectIdValid(objectIds as Types.ObjectId[]) !== true) {
        return reply.code(400).send({
          message:
            "BusinessId, selfOrderingLocationId or ordersArr's IDs not valid!",
        });
      }

      const ordersArrValidationResult = ordersArrValidation(ordersArr);
      if (ordersArrValidationResult !== true) {
        return reply.code(400).send({ message: ordersArrValidationResult });
      }

      const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
      if (validPaymentMethods !== true) {
        return reply.code(400).send({ message: validPaymentMethods });
      }

      const salesPoint = (await SalesPoint.findById(selfOrderingLocationId)
        .select("selfOrdering businessId")
        .lean()) as {
        selfOrdering: boolean;
        businessId: Types.ObjectId | { _id: Types.ObjectId };
      } | null;

      if (!salesPoint || salesPoint.selfOrdering !== true) {
        return reply.code(400).send({
          message: "Self-ordering is not available at this table.",
        });
      }

      const salesPointBusinessId =
        typeof salesPoint.businessId === "object" &&
        salesPoint.businessId !== null &&
        "_id" in salesPoint.businessId
          ? (salesPoint.businessId as { _id: Types.ObjectId })._id
          : (salesPoint.businessId as Types.ObjectId);

      if (salesPointBusinessId.toString() !== businessId.toString()) {
        return reply
          .code(400)
          .send({ message: "Sales point does not belong to this business." });
      }

      const business = (await Business.findById(
        businessId,
      ).lean()) as unknown as IBusiness | null;
      if (!business) {
        return reply.code(404).send({ message: "Business not found." });
      }
      if (!isBusinessOpenNow(business)) {
        return reply.code(403).send({
          message: "Business is currently closed for service.",
        });
      }

      const effectiveRole = await getEffectiveUserRoleAtTime({
        userId,
        businessId: new Types.ObjectId(businessId),
      });

      if (effectiveRole === "employee") {
        return reply.code(403).send({
          message:
            "On-duty employees cannot start customer self-order via QR. Use the employee open/occupy flow instead.",
        });
      }

      const existingEmployeeOpenInstance =
        await pointBusyForCustomerSelfOrder({
          salesPointId: new Types.ObjectId(selfOrderingLocationId),
          businessId: new Types.ObjectId(businessId),
        });

      if (existingEmployeeOpenInstance) {
        return reply.code(409).send({
          message:
            "Table is being served by staff. Self-ordering is not available until the table is closed.",
        });
      }

      const userDoc = (await User.findById(userId)
        .select("personalDetails.firstName personalDetails.lastName username")
        .lean()) as {
        personalDetails?: { firstName?: string; lastName?: string };
        username?: string;
      } | null;

      if (!userDoc) {
        return reply.code(404).send({ message: "User not found!" });
      }

      const clientName =
        userDoc.personalDetails?.firstName && userDoc.personalDetails?.lastName
          ? `${userDoc.personalDetails.firstName} ${userDoc.personalDetails.lastName}`
          : (userDoc.username ?? undefined);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const dailySalesReport = (await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean()) as unknown as IDailySalesReport | null;

        // payment-first contract: do not persist DailySalesReport/SalesInstance/Order
        // until payment totals are validated.
        let dailyReferenceNumber = dailySalesReport
          ? dailySalesReport.dailyReferenceNumber
          : undefined;

        const pricedOrders = await applyPromotionsToOrders({
          businessId: new Types.ObjectId(businessId),
          ordersArr: ordersArr as any,
          flow: "seated",
          session,
        });

        if (typeof pricedOrders === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: pricedOrders });
        }

        const PRICE_TOLERANCE = 0.01;
        for (let i = 0; i < pricedOrders.length; i++) {
          const backend = pricedOrders[i];
          const client = ordersArr[i];
          if (
            Math.abs(
              (client.orderNetPrice ?? 0) - (backend.orderNetPrice ?? 0),
            ) > PRICE_TOLERANCE ||
            (client.promotionApplyed !== undefined &&
              backend.promotionApplyed !== undefined &&
              client.promotionApplyed !== backend.promotionApplyed) ||
            (client.promotionApplyed === undefined &&
              backend.promotionApplyed !== undefined) ||
            (client.promotionApplyed !== undefined &&
              backend.promotionApplyed === undefined) ||
            Math.abs(
              (client.discountPercentage ?? 0) -
                (backend.discountPercentage ?? 0),
            ) > PRICE_TOLERANCE
          ) {
            await session.abortTransaction();
            return reply.code(400).send({
              message:
                "Order price or promotion does not match server calculation",
            });
          }
        }

        // Task 10: do not persist Order docs / salesGroup until payment is valid.
        // Validate payment totals against the server-calculated total net price.
        const totalOrderNetPrice = (pricedOrders as IOrder[]).reduce(
          (acc, o) => acc + (o.orderNetPrice ?? 0),
          0,
        );
        const totalPaid = paymentMethodArr.reduce(
          (acc, p) => acc + (p.methodSalesTotal || 0),
          0,
        );
        if (totalPaid < totalOrderNetPrice) {
          await session.abortTransaction();
          return reply.code(400).send({
            message:
              "Total amount paid is lower than the total price of the orders!",
          });
        }

        // payment-first contract: only persist DailySalesReport/SalesInstance/Orders after totals validation
        if (dailyReferenceNumber === undefined) {
          const createdDailyReferenceNumber = await createDailySalesReport(
            businessId as Types.ObjectId,
            session,
          );
          if (typeof createdDailyReferenceNumber === "string") {
            await session.abortTransaction();
            return reply.code(400).send({
              message: createdDailyReferenceNumber,
            });
          }
          dailyReferenceNumber = createdDailyReferenceNumber;
        }

        const newSalesInstanceObj = {
          dailyReferenceNumber,
          salesPointId: new Types.ObjectId(selfOrderingLocationId),
          guests: 1,
          salesInstanceStatus: "Occupied",
          openedByUserId: userId,
          openedAsRole: "customer" as const,
          businessId: new Types.ObjectId(businessId),
          clientName,
          paymentId,
        };

        const salesInstanceResult = (await createSalesInstance(
          newSalesInstanceObj as ISalesInstance,
          session,
        )) as ISalesInstance | string;

        if (typeof salesInstanceResult === "string") {
          // Race handling: if the paymentId unique index rejected the insert, return the existing instance.
          await session.abortTransaction();
          const existing = await SalesInstance.findOne({
            paymentId,
            businessId,
            openedAsRole: "customer",
          })
            .select("_id salesInstanceStatus")
            .lean();

          if (existing) {
            const existingSalesInstanceDoc = await SalesInstance.findById(
              existing._id,
            )
              .select(
                "dailyReferenceNumber salesGroup.orderCode salesGroup.ordersIds",
              )
              .lean();

            const paidOrders = await Order.find({
              salesInstanceId: existing._id,
              billingStatus: "Paid",
            })
              .select("orderNetPrice _id")
              .lean();

            const paidOrderIds = paidOrders.map((o: any) => o._id);
            const paidOrderIdsSet = new Set(paidOrderIds.map(String));
            const totalNetPaidAmount = paidOrders.reduce(
              (acc: number, o: any) => acc + (o.orderNetPrice ?? 0),
              0,
            );

            const orderCodeForReceipt =
              existingSalesInstanceDoc?.salesGroup?.find((group: any) =>
                (group.ordersIds ?? []).some((id: any) =>
                  paidOrderIdsSet.has(String(id)),
                ),
              )?.orderCode ??
              existingSalesInstanceDoc?.salesGroup?.[0]?.orderCode;

            sendOrderConfirmation(userId, businessId as Types.ObjectId, {
              dailyReferenceNumber:
                existingSalesInstanceDoc?.dailyReferenceNumber ??
                (dailyReferenceNumber as any),
              totalNetPaidAmount,
              orderCount: paidOrders.length,
              orderCode: orderCodeForReceipt,
              flow: "selfOrder",
              idempotencyKey: paymentId,
            }).catch(() => {});

            return reply.code(200).send({
              message: "Self-order already processed for this payment.",
              salesInstanceId: existing._id,
            });
          }

          return reply.code(400).send({ message: salesInstanceResult });
        }

        const salesInstance = salesInstanceResult;

        const createdOrders = await createOrders(
          String(dailyReferenceNumber),
          ordersArr,
          userId,
          "customer",
          salesInstance._id as Types.ObjectId,
          new Types.ObjectId(businessId),
          session,
        );

        if (typeof createdOrders === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: createdOrders });
        }

        const createdOrdersIds: Types.ObjectId[] = (
          createdOrders as IOrder[]
        ).map((order: { _id: Types.ObjectId }) => order._id);

        const closeOrdersResult = await closeOrders(
          createdOrdersIds,
          paymentMethodArr,
          salesInstance._id as Types.ObjectId,
          session,
        );

        if (closeOrdersResult !== true) {
          await session.abortTransaction();
          return reply.code(400).send({ message: closeOrdersResult });
        }

        await session.commitTransaction();

        // Idea doc §9: ensure receipts reference the correct batch `orderCode`.
        const createdOrderIds = (createdOrders as IOrder[]).map(
          (order) => order._id as Types.ObjectId,
        );
        const createdOrderIdsSet = new Set(createdOrderIds.map(String));
        const salesInstanceForOrderCode = await SalesInstance.findOne({
          _id: new Types.ObjectId(salesInstance._id),
          "salesGroup.ordersIds": { $in: createdOrderIds },
        })
          .select("salesGroup.orderCode salesGroup.ordersIds")
          .lean();
        const orderCodeForReceipt =
          salesInstanceForOrderCode?.salesGroup?.find((group: any) =>
            (group.ordersIds ?? []).some((id: any) =>
              createdOrderIdsSet.has(String(id)),
            ),
          )?.orderCode ?? salesInstanceForOrderCode?.salesGroup?.[0]?.orderCode;

        const totalNetPaidAmount = (createdOrders as IOrder[]).reduce(
          (acc: number, order: { orderNetPrice: number }) =>
            acc + order.orderNetPrice,
          0,
        );

        const businessIdObjectId = new Types.ObjectId(businessId);
        checkLowStockAndNotify(businessIdObjectId).catch(() => {});
        sendOrderConfirmation(userId, businessIdObjectId, {
          dailyReferenceNumber,
          totalNetPaidAmount,
          orderCount: (createdOrders as IOrder[]).length,
          orderCode: orderCodeForReceipt,
          flow: "selfOrder",
          clientName,
          idempotencyKey: paymentId,
        }).catch(() => {});

        return reply
          .code(201)
          .send({ message: "Customer self ordering created" });
      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return reply.code(500).send({
          message: "Create salesInstance failed!",
          error: error instanceof Error ? error.message : error,
        });
      } finally {
        session.endSession();
      }
    },
  );
};
