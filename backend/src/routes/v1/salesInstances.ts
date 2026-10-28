/**
 * SalesInstances Routes — POS/employee CRUD plus the delivery and
 * self-ordering flows.
 *
 * Every route declares its body/params as a strict zod DTO from
 * `packages/schemas/salesInstances.ts`; validation and sanitization happen at
 * the boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. Cross-field and business rules —
 * `ordersArrValidation`, `validatePaymentMethodArray`, the paid>=total check,
 * ownership/role guards and the `paymentId` idempotency guards — stay in the
 * route as named post-parse checks.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  IDailySalesReport,
} from "restaurant-pos-packages/interfaces/IDailySalesReport";
import type { ISalesInstance } from "restaurant-pos-packages/interfaces/ISalesInstance";
import type { IOrder } from "restaurant-pos-packages/interfaces/IOrder";
import type { IAddress } from "restaurant-pos-packages/interfaces/IAddress";
import type { IBusiness } from "restaurant-pos-packages/interfaces/IBusiness";

import {
  badRequest,
  conflict,
  forbidden,
  internal,
  notFound,
  unauthorized,
  type AppError,
} from "../../errors/appError.ts";
import { appendAuditEntry } from "../../audit/appendAuditEntry.ts";
import {
  AUDIT_ACT_KINDS,
  AUDIT_ACTOR_KINDS,
  AUDIT_TARGET_KINDS,
} from "../../audit/auditCatalogue.ts";
import {
  createDeliveryOrderBodySchema,
  createSalesInstanceBodySchema,
  createSelfOrderBodySchema,
  openSelfOrderingTableBodySchema,
  salesInstancesIncludeDeletedQuerySchema,
  salesInstanceIdParamsSchema,
  salesInstancesByBusinessParamsSchema,
  salesInstancesByUserParamsSchema,
  selfOrderingLocationIdParamsSchema,
  transferSalesPointBodySchema,
  updateSalesInstanceBodySchema,
  type CreateDeliveryOrderBody,
  type CreateSalesInstanceBody,
  type CreateSelfOrderBody,
  type OpenSelfOrderingTableBody,
  type SalesInstanceIdParams,
  type SalesInstancesIncludeDeletedQuery,
  type SalesInstancesByBusinessParams,
  type SalesInstancesByUserParams,
  type SelfOrderingLocationIdParams,
  type TransferSalesPointBody,
  type UpdateSalesInstanceBody,
} from "restaurant-pos-packages/schemas/salesInstances";
import {
  OPERATIONAL_REASON_ACTS,
  resolveOperationalReason,
} from "restaurant-pos-packages/operationalReasons";
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
import toPreparedOrders from "../../orders/toPreparedOrders.ts";
import orderPriceMatches from "../../orders/orderPriceMatches.ts";
import applyPromotionsToOrders from "../../promotions/applyPromotions.ts";
import checkLowStockAndNotify from "../../inventories/checkLowStockAndNotify.ts";
import sendOrderConfirmation from "../../orderConfirmation/sendOrderConfirmation.ts";
import {
  createAuthHook,
  createOptionalAuthHook,
} from "../../auth/middleware.ts";
import transferOrdersBetweenSalesInstances from "../../orders/transferOrdersBetweenSalesInstances.ts";
import getEffectiveUserRoleAtTime from "../../auth/getEffectiveUserRoleAtTime.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  isBusinessOpenNow,
  isDeliveryOpenNow,
} from "../../business/isBusinessOpenNow.ts";
import * as enums from "restaurant-pos-packages/enums";

const { managementRolesEnums } = enums;

/**
 * Turn the HTTP-shaped result of the employee open-table transaction into a
 * typed `AppError` so the global handler emits problem details.
 */
function employeeTxnError(
  body: Record<string, unknown>,
  status: number,
): AppError {
  const detail =
    typeof body.message === "string" ? body.message : "Request failed";
  return status === 409 ? conflict(detail) : badRequest(detail);
}

export const salesInstancesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: SalesInstancesIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: salesInstancesIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const salesInstances = await SalesInstance.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
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
        throw notFound("No salesInstances found!");
      }
      return reply.code(200).send(salesInstances);
    },
  );

  app.post<{ Body: CreateSalesInstanceBody }>(
    "/",
    {
      preValidation: [createAuthHook(app)],
      schema: { body: createSalesInstanceBodySchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }
      const openedByUserId = new Types.ObjectId(req.authSession.id);

      const {
        salesPointId,
        guests,
        salesInstanceStatus,
        businessId,
        clientName,
      } = req.body;

      const effectiveRole = await getEffectiveUserRoleAtTime({
        userId: openedByUserId,
        businessId,
      });
      if (effectiveRole !== "employee") {
        throw forbidden(
          "You must be an on-duty employee to open a table from the POS.",
        );
      }

      const salesPointExists = await SalesPoint.exists(
        withSoftDeleteFilter({
          _id: salesPointId,
          businessId: new Types.ObjectId(businessId),
        }),
      );
      if (!salesPointExists) {
        throw notFound(
          "Sales point does not belong to this business (or does not exist)!",
        );
      }

      const outcome = await runEmployeeSalesInstanceTxn(async (session) => {
        const dailySalesReport = (await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId: new Types.ObjectId(businessId),
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
        throw employeeTxnError(outcome.body, outcome.status);
      }
      return reply
        .code(201)
        .send({ message: "SalesInstance created successfully!" });
    },
  );

  app.get<{
    Params: SalesInstanceIdParams;
    Querystring: SalesInstancesIncludeDeletedQuery;
  }>(
    "/:salesInstanceId",
    {
      schema: {
        params: salesInstanceIdParamsSchema,
        querystring: salesInstancesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { salesInstanceId } = req.params;
      const { includeDeleted = false } = req.query;

      const salesInstance = await SalesInstance.findOne(
        withSoftDeleteFilter({ _id: salesInstanceId }, includeDeleted),
      )
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
        throw notFound("SalesLocation not found!");
      }

      return reply.code(200).send(salesInstance);
    },
  );

  app.patch<{ Params: SalesInstanceIdParams; Body: UpdateSalesInstanceBody }>(
    "/:salesInstanceId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: {
        params: salesInstanceIdParamsSchema,
        body: updateSalesInstanceBodySchema,
      },
    },
    async (req, reply) => {
      const { salesInstanceId } = req.params;

      const sessionUserId =
        req.authSession?.type === "user"
          ? new Types.ObjectId(req.authSession.id)
          : null;

      const {
        ordersIdsArr,
        cancel,
        ordersNewBillingStatus,
        reasonCode,
        reasonNote,
        paymentMethodArr,
        toSalesInstanceId,
        guests,
        salesInstanceStatus,
        responsibleByUserId,
        clientName,
      } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const salesInstance = (await SalesInstance.findOne(
          withSoftDeleteFilter({ _id: salesInstanceId }),
        )
          .select(
            "openedByUserId businessId salesInstanceStatus salesGroup openedAsRole salesPointId"
          )
          .session(session)
          .lean()) as unknown as ISalesInstance | null;

        if (!salesInstance) {
          throw notFound("SalesInstance not found!");
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
        const isFinalizationStatus =
          ordersNewBillingStatus === "Void" ||
          ordersNewBillingStatus === "Invitation";

        if (
          !isFinalizationStatus &&
          (reasonCode !== undefined || reasonNote !== undefined)
        ) {
          throw badRequest(
            "A reason is only accepted when finalizing orders as Void or Invitation.",
          );
        }

        const wantsAnyRestrictedOperation =
          wantsCancel ||
          wantsCloseWithPayment ||
          wantsTransferOrders ||
          wantsFinalizeWithoutPayment;

        // Carve-out (idea doc §4/§E): customer-open/delivery/self-order sessions must not use these PATCH operations.
        if (wantsAnyRestrictedOperation && salesInstance.openedAsRole !== "employee") {
          throw conflict(
            'Operation not allowed: only employee-open SalesInstances can be cancelled, closed with payment, or have orders transferred via this endpoint.',
          );
        }

        // Idea doc §4: close/transfer/cancel should require an auth session.
        if (wantsAnyRestrictedOperation && !sessionUserId) {
          throw unauthorized(
            "Unauthorized; authenticated employee session is required for this operation.",
          );
        }

        // Task 5 (idea doc): order-to-salesInstance integrity.
        // Ensure that:
        // - close/cancel operations touch orders that belong to the receiver (patched SalesInstance)
        // - transfer operations touch orders that belong to the source (toSalesInstanceId)
        if (wantsAnyRestrictedOperation && ordersIdsArr && ordersIdsArr.length > 0) {
          const uniqueOrderIds = new Set(ordersIdsArr);
          if (uniqueOrderIds.size !== ordersIdsArr.length) {
            throw badRequest(
              "Invalid ordersIdsArr: duplicates are not allowed.",
            );
          }

          const orderObjectIds = ordersIdsArr.map((id) => new Types.ObjectId(id));

          // Receiver-transfer contract:
          // PATCH /:salesInstanceId is the receiver instance.
          // Body `toSalesInstanceId` is the source instance (current owner of the orders).
          const ordersOwnerSalesInstanceId = wantsTransferOrders
            ? new Types.ObjectId(toSalesInstanceId!)
            : new Types.ObjectId(salesInstanceId);

          if (wantsTransferOrders) {
            const sourceSalesInstance = await SalesInstance.findOne(
              withSoftDeleteFilter({ _id: toSalesInstanceId }),
            )
              .select("businessId salesInstanceStatus openedAsRole")
              .session(session)
              .lean();

            if (!sourceSalesInstance) {
              throw notFound(
                "Source salesInstance not found for transfer (toSalesInstanceId).",
              );
            }

            if (
              sourceSalesInstance.businessId.toString() !==
              salesInstance.businessId.toString()
            ) {
              throw badRequest(
                "Source and receiver salesInstances must belong to the same business.",
              );
            }

            if (sourceSalesInstance.openedAsRole !== "employee") {
              throw conflict(
                "Operation not allowed: can only transfer orders from an employee-open SalesInstance.",
              );
            }

            if (sourceSalesInstance.salesInstanceStatus === "Closed") {
              throw conflict(
                "Operation not allowed: can not transfer from a closed source SalesInstance.",
              );
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
            throw notFound(
              "Some orders do not belong to this SalesInstance (or its business).",
            );
          }

          // Idea doc §4/§E: close/cancel/transfer should operate only on Open billing orders.
          if (orders.some((o) => o.billingStatus !== "Open")) {
            throw badRequest(
              "Only orders with billingStatus 'Open' can be closed, cancelled, or transferred.",
            );
          }

          // Cancel-specific rule: do not allow cancelling orders already completed in the order flow.
          if (wantsCancel && orders.some((o) => o.orderStatus === "Done")) {
            throw badRequest("Cannot cancel orders with orderStatus 'Done'!");
          }
        }

        const hasOrders = Boolean(
          salesInstance.salesGroup?.some(
            (group: { ordersIds?: unknown[] }) =>
              Array.isArray(group.ordersIds) && group.ordersIds.length > 0,
          ),
        );

        // ADR-0003: only a tab that is closed with no orders is discarded.
        // A name, guest, or reservation update leaves the empty sitting in place.
        // The discard runs outside this read transaction. A concurrent order write
        // then misses the filter and the sitting is marked deleted, instead of
        // aborting the transaction on a write conflict.
        if (!hasOrders && salesInstanceStatus === "Closed") {
          await session.abortTransaction();

          const discardFilter = {
            ...withSoftDeleteFilter({ _id: salesInstanceId }),
            salesGroup: {
              $not: {
                $elemMatch: {
                  ordersIds: { $exists: true, $ne: [] },
                },
              },
            },
          };
          const deleteResult = await SalesInstance.deleteOne(discardFilter);
          const retainedAfterOrdersArrived =
            deleteResult.deletedCount === 1
              ? false
              : await markAsDeletedById(
                  SalesInstance as mongoose.Model<
                    ISalesInstance & { deleted: boolean }
                  >,
                  salesInstanceId,
                  {
                    deletedBy: sessionUserId
                      ? String(sessionUserId)
                      : undefined,
                  },
                );

          if (deleteResult.deletedCount === 1 || retainedAfterOrdersArrived) {
            return reply
              .code(200)
              .send({ message: "SalesInstance updated successfully!" });
          }

          throw notFound("SalesInstance not found!");
        }

        if (responsibleByUserId && !sessionUserId) {
          throw unauthorized("Unauthorized to set responsible user");
        }

        if (cancel && ordersIdsArr && ordersIdsArr.length > 0) {
          if (!sessionUserId) {
            throw unauthorized(
              "Unauthorized; userId from session is required to cancel orders!",
            );
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
            throw forbidden("Only on-duty management roles can cancel orders!");
          }

          const cancelOrdersResult = await cancelOrders(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            new Types.ObjectId(salesInstanceId),
            session,
          );

          if (cancelOrdersResult !== true) {
            throw badRequest(cancelOrdersResult);
          }
        }

        if (wantsFinalizeWithoutPayment && ordersIdsArr && ordersIdsArr.length > 0) {
          if (!sessionUserId) {
            throw unauthorized(
              "Unauthorized; authenticated management session is required to finalize orders as Void/Invitation.",
            );
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
            throw forbidden(
              "Only management roles can finalize orders as Void/Invitation.",
            );
          }

          if (reasonCode === undefined) {
            throw badRequest(
              "A reason code is required to finalize orders as Void or Invitation.",
            );
          }

          const status = ordersNewBillingStatus as "Void" | "Invitation";
          const resolvedReason = resolveOperationalReason(
            status === "Void"
              ? OPERATIONAL_REASON_ACTS.VOID
              : OPERATIONAL_REASON_ACTS.INVITATION,
            reasonCode,
            reasonNote,
          );
          if (!resolvedReason.success) {
            throw badRequest(resolvedReason.error);
          }

          const finalizeResult = await finalizeOrdersBillingStatus(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            new Types.ObjectId(salesInstanceId),
            status,
            { code: resolvedReason.code, note: resolvedReason.note },
            session,
          );

          if (finalizeResult !== true) {
            throw badRequest(finalizeResult);
          }

          const appended = await appendAuditEntry({
            actor: {
              kind: AUDIT_ACTOR_KINDS.USER,
              id: sessionUserId,
            },
            actKind:
              status === "Void"
                ? AUDIT_ACT_KINDS.ORDER_VOIDED
                : AUDIT_ACT_KINDS.ORDER_INVITED,
            target: {
              kind: AUDIT_TARGET_KINDS.SALES_INSTANCE,
              id: salesInstanceId,
            },
            relatedTargets: ordersIdsArr.map((id) => ({
              kind: AUDIT_TARGET_KINDS.ORDER,
              id,
            })),
            businessId: salesInstance.businessId,
            occurredAt: new Date(),
            payload: {
              billingStatus: status,
              orderIds: ordersIdsArr,
              reasonCode: resolvedReason.code,
              ...(resolvedReason.note === undefined
                ? {}
                : { reasonNote: resolvedReason.note }),
            },
            session,
          });

          if (!appended.success) {
            throw internal(
              "Failed to append the Void/Invitation audit entry!",
            );
          }
        }

        if (paymentMethodArr && ordersIdsArr && ordersIdsArr.length > 0) {
          const validPaymentMethods =
            validatePaymentMethodArray(paymentMethodArr);
          if (validPaymentMethods !== true) {
            throw badRequest(validPaymentMethods);
          }

          const closeOrdersResult = await closeOrders(
            ordersIdsArr.map((id) => new Types.ObjectId(id)),
            paymentMethodArr,
            new Types.ObjectId(salesInstanceId),
            session,
          );

          if (closeOrdersResult !== true) {
            throw badRequest(closeOrdersResult);
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
            throw badRequest(transferResult);
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
          withSoftDeleteFilter({ _id: salesInstanceId }),
          { $set: updatedSalesInstanceObj },
          { session },
        );

        if (
          updatedSalesInstance.modifiedCount === 0 &&
          Object.keys(updatedSalesInstanceObj).length > 0
        ) {
          throw notFound("SalesInstance not found!");
        }

        await session.commitTransaction();

        return reply
          .code(200)
          .send({ message: "SalesInstance updated successfully!" });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  app.delete<{ Params: SalesInstanceIdParams }>(
    "/:salesInstanceId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: salesInstanceIdParamsSchema },
    },
    async (req, reply) => {
      const { salesInstanceId } = req.params;

      const salesInstance = await SalesInstance.findById(salesInstanceId)
        .setOptions({ includeDeleted: true })
        .select("salesGroup deleted")
        .lean();

      if (!salesInstance) {
        throw notFound("Sales instance not found!");
      }

      if (salesInstance.deleted) {
        throw conflict("Sales instance already deleted!");
      }

      const hasOrders = Boolean(
        salesInstance.salesGroup?.some(
          (group: { ordersIds?: unknown[] }) =>
            Array.isArray(group.ordersIds) && group.ordersIds.length > 0,
        ),
      );

      if (!hasOrders) {
        // ADR-0003 exception: transient order-less SalesInstances are discarded.
        const discardResult = await SalesInstance.deleteOne({
          ...withSoftDeleteFilter({ _id: salesInstanceId }),
          // Re-check exception eligibility at write time to avoid hard-deleting
          // instances that gained orders concurrently after the initial read.
          salesGroup: {
            $not: {
              $elemMatch: {
                ordersIds: { $exists: true, $ne: [] },
              },
            },
          },
        });

        if (discardResult.deletedCount === 1) {
          return reply
            .code(200)
            .send({ message: "Sales instance deleted successfully!" });
        }

        // If another write changed the instance shape between read/delete, fall through to soft-delete.
      }

      const wasDeleted = await markAsDeletedById(
        SalesInstance as mongoose.Model<ISalesInstance & { deleted: boolean }>,
        salesInstanceId,
        { deletedBy: req.authSession?.id },
      );
      if (!wasDeleted) {
        throw conflict("Sales instance already deleted!");
      }

      return reply
        .code(200)
        .send({ message: "Sales instance deleted successfully!" });
    },
  );

  app.patch<
    { Params: SalesInstanceIdParams; Body: TransferSalesPointBody }
  >(
    "/:salesInstanceId/transferSalesPoint",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: salesInstanceIdParamsSchema,
        body: transferSalesPointBodySchema,
      },
    },
    async (req, reply) => {
      const { salesInstanceId } = req.params;

      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }
      const sessionUserId = new Types.ObjectId(req.authSession.id);

      const { salesPointId } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const salesInstance = (await SalesInstance.findOne(
          withSoftDeleteFilter({ _id: salesInstanceId }),
        )
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
          throw notFound("SalesInstance not found!");
        }

        if (salesInstance.salesInstanceStatus === "Closed") {
          throw conflict("SalesInstance is closed!");
        }

        if (salesInstance.openedAsRole !== "employee") {
          throw conflict(
            "Operation not allowed: only employee-open SalesInstances can be transferred between sales points via this endpoint.",
          );
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
          throw forbidden("Forbidden");
        }

        const sp = await SalesPoint.exists(
          withSoftDeleteFilter({
            _id: salesPointId,
            businessId: salesInstance.businessId,
          }),
        ).session(session);

        if (!sp) {
          throw notFound("SalesPoint not found for this business!");
        }

        const openConflict = await pointBusyForEmployee({
          salesPointId: new Types.ObjectId(salesPointId),
          businessId: salesInstance.businessId,
          session,
          excludeSalesInstanceId: new Types.ObjectId(salesInstanceId),
        });

        if (openConflict) {
          throw conflict(
            "Cannot move to this salesPoint because it already has an open SalesInstance!",
          );
        }

        const moved = await SalesInstance.updateOne(
          withSoftDeleteFilter({ _id: salesInstanceId }),
          { $set: { salesPointId } },
          { session },
        );

        if (moved.modifiedCount !== 1) {
          throw badRequest("SalesInstance not moved!");
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
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  app.get<{
    Params: SalesInstancesByBusinessParams;
    Querystring: SalesInstancesIncludeDeletedQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: salesInstancesByBusinessParamsSchema,
        querystring: salesInstancesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const salesInstances = await SalesInstance.find(
        withSoftDeleteFilter({ businessId }, includeDeleted),
      )
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
        throw notFound("No salesInstances found!");
      }

      return reply.code(200).send(salesInstances);
    },
  );

  app.get<{
    Params: SalesInstancesByUserParams;
    Querystring: SalesInstancesIncludeDeletedQuery;
  }>(
    "/user/:userId",
    {
      schema: {
        params: salesInstancesByUserParamsSchema,
        querystring: salesInstancesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { includeDeleted = false } = req.query;

      const salesInstances = await SalesInstance.find(
        withSoftDeleteFilter(
          { $or: [{ openedByUserId: userId }, { responsibleByUserId: userId }] },
          includeDeleted,
        ),
      )
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
        throw notFound("No salesInstances found!");
      }

      return reply.code(200).send(salesInstances);
    },
  );

  app.post<{
    Params: SelfOrderingLocationIdParams;
    Body: OpenSelfOrderingTableBody;
  }>(
    "/selfOrderingLocation/:selfOrderingLocationId/openTable",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: selfOrderingLocationIdParamsSchema,
        body: openSelfOrderingTableBodySchema,
      },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }
      const openedByUserId = new Types.ObjectId(req.authSession.id);

      const { selfOrderingLocationId } = req.params;
      const { businessId, guests } = req.body;

      const salesPoint = (await SalesPoint.findOne(
        withSoftDeleteFilter({ _id: selfOrderingLocationId }),
      )
        .select("businessId")
        .lean()) as {
        businessId: Types.ObjectId | { _id: Types.ObjectId };
      } | null;

      if (!salesPoint) {
        throw notFound("Sales point not found");
      }

      const salesPointBusinessId =
        typeof salesPoint.businessId === "object" &&
        salesPoint.businessId !== null &&
        "_id" in salesPoint.businessId
          ? (salesPoint.businessId as { _id: Types.ObjectId })._id
          : (salesPoint.businessId as Types.ObjectId);

      if (salesPointBusinessId.toString() !== businessId.toString()) {
        throw badRequest("Sales point does not belong to this business");
      }

      const effectiveRole = await getEffectiveUserRoleAtTime({
        userId: openedByUserId,
        businessId: new Types.ObjectId(businessId),
      });
      if (effectiveRole !== "employee") {
        throw forbidden("Employee must be on duty to open a table from QR");
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
        throw employeeTxnError(openOutcome.body, openOutcome.status);
      }
      return reply.code(201).send(openOutcome.doc);
    },
  );

  app.post<{ Body: CreateDeliveryOrderBody }>(
    "/delivery",
    {
      preValidation: [createAuthHook(app)],
      schema: { body: createDeliveryOrderBodySchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }
      const userId = new Types.ObjectId(req.authSession.id);

      const { businessId, ordersArr, paymentMethodArr, deliveryAddress, paymentId } =
        req.body;

      // Idempotency: if this payment was already accepted and processed, return the existing SalesInstance.
      const existingSalesInstanceForPayment = await SalesInstance.findOne(
        withSoftDeleteFilter(
          {
            paymentId,
            businessId,
            openedAsRole: "customer",
          },
          true,
        ),
      )
        .select("_id salesInstanceStatus")
        .lean();

      if (existingSalesInstanceForPayment?.salesInstanceStatus === "Closed") {
        const existingSalesInstanceDoc = await SalesInstance.findById(
          existingSalesInstanceForPayment._id,
        ).setOptions({ includeDeleted: true })
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

        sendOrderConfirmation(userId, new Types.ObjectId(businessId), {
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
        throw conflict(
          "Delivery payment acceptance is already in progress for this paymentId.",
        );
      }

      const preparedOrders = toPreparedOrders(ordersArr);

      const ordersArrValidationResult = ordersArrValidation(preparedOrders);
      if (ordersArrValidationResult !== true) {
        throw badRequest(ordersArrValidationResult);
      }

      const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
      if (validPaymentMethods !== true) {
        throw badRequest(validPaymentMethods);
      }

      const [businessDoc, user] = await Promise.all([
        Business.findOne(withSoftDeleteFilter({ _id: businessId })).lean<IBusiness>(),
        User.findById(userId)
          .select(
            "address personalDetails.firstName personalDetails.lastName username",
          )
          .lean(),
      ]);

      if (!businessDoc) {
        throw notFound("Business not found.");
      }

      if (!businessDoc.acceptsDelivery) {
        throw badRequest("This business does not accept delivery.");
      }

      if (!isDeliveryOpenNow(businessDoc)) {
        throw forbidden("Delivery is currently unavailable.");
      }

      if (!user) {
        throw notFound("User not found!");
      }

      const resolvedDeliveryAddress: IAddress | undefined =
        deliveryAddress ?? (user as { address?: IAddress }).address;

      const deliverySalesPoint = (await SalesPoint.findOne(
        withSoftDeleteFilter({
          businessId,
          salesPointType: "delivery",
        }),
      )
        .select("_id")
        .lean()) as { _id: Types.ObjectId } | null;

      if (!deliverySalesPoint?._id) {
        throw badRequest("Delivery sales point not configured for this business.");
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const dailySalesReport = await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean<IDailySalesReport>();

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
          businessId: new Types.ObjectId(businessId),
          ordersArr: preparedOrders,
          flow: "delivery",
          session,
        });

        if (typeof ordersWithPromotions === "string") {
          throw badRequest(ordersWithPromotions);
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
          throw badRequest(
            "Total amount paid is lower than the total price of the orders!",
          );
        }

        // Only now we create daily reference/report persistence (if needed) and persist SalesInstance/Orders.
        if (dailyReferenceNumber === undefined) {
          const createdDailyReferenceNumber = await createDailySalesReport(
            new Types.ObjectId(businessId),
            session,
          );
          if (typeof createdDailyReferenceNumber === "string") {
            throw badRequest(createdDailyReferenceNumber);
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
          businessId: new Types.ObjectId(businessId),
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
          const existing = await SalesInstance.findOne(
            withSoftDeleteFilter(
              {
                paymentId,
                businessId,
                openedAsRole: "customer",
              },
              true,
            ),
          )
            .select("_id salesInstanceStatus")
            .lean();

          if (existing) {
            const existingSalesInstanceDoc = await SalesInstance.findById(
              existing._id,
            )
              .setOptions({ includeDeleted: true })
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

            sendOrderConfirmation(userId, new Types.ObjectId(businessId), {
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

          throw badRequest(salesInstance);
        }

        const createdOrders = (await createOrders(
          String(dailyReferenceNumber),
          ordersWithPromotions as IOrder[],
          userId,
          "customer",
          (salesInstance as ISalesInstance)._id as Types.ObjectId,
          new Types.ObjectId(businessId),
          session,
        )) as IOrder[] | string;

        if (typeof createdOrders === "string") {
          throw badRequest(createdOrders);
        }

        const closeOrdersResult = await closeOrders(
          createdOrders.map((order) => order._id as Types.ObjectId),
          paymentMethodArr,
          salesInstance._id as Types.ObjectId,
          session,
        );

        if (typeof closeOrdersResult === "string") {
          throw badRequest(closeOrdersResult);
        }

        await session.commitTransaction();

        checkLowStockAndNotify(new Types.ObjectId(businessId)).catch(() => {});

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

        sendOrderConfirmation(userId, new Types.ObjectId(businessId), {
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
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  app.post<{
    Params: SelfOrderingLocationIdParams;
    Body: CreateSelfOrderBody;
  }>(
    "/selfOrderingLocation/:selfOrderingLocationId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: selfOrderingLocationIdParamsSchema,
        body: createSelfOrderBodySchema,
      },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }
      const userId = new Types.ObjectId(req.authSession.id);

      const { selfOrderingLocationId } = req.params;
      const { businessId, ordersArr, paymentMethodArr, paymentId } = req.body;

      // Idempotency: if this payment was already accepted and processed, return the existing SalesInstance.
      const existingSalesInstanceForPayment = await SalesInstance.findOne(
        withSoftDeleteFilter(
          {
            paymentId,
            businessId,
            openedAsRole: "customer",
          },
          true,
        ),
      )
        .select("_id salesInstanceStatus")
        .lean();

      if (existingSalesInstanceForPayment?.salesInstanceStatus === "Closed") {
        const existingSalesInstanceDoc = await SalesInstance.findById(
          existingSalesInstanceForPayment._id,
        ).setOptions({ includeDeleted: true })
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

        sendOrderConfirmation(userId, new Types.ObjectId(businessId), {
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
        throw conflict(
          "Self-order payment acceptance is already in progress for this paymentId.",
        );
      }

      const preparedOrders = toPreparedOrders(ordersArr);

      const ordersArrValidationResult = ordersArrValidation(preparedOrders);
      if (ordersArrValidationResult !== true) {
        throw badRequest(ordersArrValidationResult);
      }

      const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
      if (validPaymentMethods !== true) {
        throw badRequest(validPaymentMethods);
      }

      const salesPoint = (await SalesPoint.findOne(
        withSoftDeleteFilter({ _id: selfOrderingLocationId }),
      )
        .select("selfOrdering businessId")
        .lean()) as {
        selfOrdering: boolean;
        businessId: Types.ObjectId | { _id: Types.ObjectId };
      } | null;

      if (!salesPoint || salesPoint.selfOrdering !== true) {
        throw badRequest("Self-ordering is not available at this table.");
      }

      const salesPointBusinessId =
        typeof salesPoint.businessId === "object" &&
        salesPoint.businessId !== null &&
        "_id" in salesPoint.businessId
          ? (salesPoint.businessId as { _id: Types.ObjectId })._id
          : (salesPoint.businessId as Types.ObjectId);

      if (salesPointBusinessId.toString() !== businessId.toString()) {
        throw badRequest("Sales point does not belong to this business.");
      }

      const business = await Business.findOne(
        withSoftDeleteFilter({ _id: businessId }),
      ).lean<IBusiness>();
      if (!business) {
        throw notFound("Business not found.");
      }
      if (!isBusinessOpenNow(business)) {
        throw forbidden("Business is currently closed for service.");
      }

      const effectiveRole = await getEffectiveUserRoleAtTime({
        userId,
        businessId: new Types.ObjectId(businessId),
      });

      if (effectiveRole === "employee") {
        throw forbidden(
          "On-duty employees cannot start customer self-order via QR. Use the employee open/occupy flow instead.",
        );
      }

      const existingEmployeeOpenInstance =
        await pointBusyForCustomerSelfOrder({
          salesPointId: new Types.ObjectId(selfOrderingLocationId),
          businessId: new Types.ObjectId(businessId),
        });

      if (existingEmployeeOpenInstance) {
        throw conflict(
          "Table is being served by staff. Self-ordering is not available until the table is closed.",
        );
      }

      const userDoc = (await User.findById(userId)
        .select("personalDetails.firstName personalDetails.lastName username")
        .lean()) as {
        personalDetails?: { firstName?: string; lastName?: string };
        username?: string;
      } | null;

      if (!userDoc) {
        throw notFound("User not found!");
      }

      const clientName =
        userDoc.personalDetails?.firstName && userDoc.personalDetails?.lastName
          ? `${userDoc.personalDetails.firstName} ${userDoc.personalDetails.lastName}`
          : (userDoc.username ?? undefined);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const dailySalesReport = await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean<IDailySalesReport>();

        // payment-first contract: do not persist DailySalesReport/SalesInstance/Order
        // until payment totals are validated.
        let dailyReferenceNumber = dailySalesReport
          ? dailySalesReport.dailyReferenceNumber
          : undefined;

        const pricedOrders = await applyPromotionsToOrders({
          businessId: new Types.ObjectId(businessId),
          ordersArr: preparedOrders,
          flow: "seated",
          session,
        });

        if (typeof pricedOrders === "string") {
          throw badRequest(pricedOrders);
        }

        for (let i = 0; i < pricedOrders.length; i++) {
          if (!orderPriceMatches(preparedOrders[i], pricedOrders[i])) {
            throw badRequest(
              "Order price or promotion does not match server calculation",
            );
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
          throw badRequest(
            "Total amount paid is lower than the total price of the orders!",
          );
        }

        // payment-first contract: only persist DailySalesReport/SalesInstance/Orders after totals validation
        if (dailyReferenceNumber === undefined) {
          const createdDailyReferenceNumber = await createDailySalesReport(
            new Types.ObjectId(businessId),
            session,
          );
          if (typeof createdDailyReferenceNumber === "string") {
            throw badRequest(createdDailyReferenceNumber);
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
          const existing = await SalesInstance.findOne(
            withSoftDeleteFilter(
              {
                paymentId,
                businessId,
                openedAsRole: "customer",
              },
              true,
            ),
          )
            .select("_id salesInstanceStatus")
            .lean();

          if (existing) {
            const existingSalesInstanceDoc = await SalesInstance.findById(
              existing._id,
            )
              .setOptions({ includeDeleted: true })
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

            sendOrderConfirmation(userId, new Types.ObjectId(businessId), {
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

          throw badRequest(salesInstanceResult);
        }

        const salesInstance = salesInstanceResult;

        const createdOrders = await createOrders(
          String(dailyReferenceNumber),
          preparedOrders,
          userId,
          "customer",
          salesInstance._id as Types.ObjectId,
          new Types.ObjectId(businessId),
          session,
        );

        if (typeof createdOrders === "string") {
          throw badRequest(createdOrders);
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
          throw badRequest(closeOrdersResult);
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
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );
};
