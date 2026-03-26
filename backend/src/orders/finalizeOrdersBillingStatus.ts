import { ClientSession, Types } from "mongoose";
import type { IOrder } from "../../../packages/interfaces/IOrder.ts";
import type { IGoodsReduced } from "../../../packages/interfaces/IDailySalesReport.ts";
import Order from "../models/order.ts";
import SalesInstance from "../models/salesInstance.ts";
import SalesPoint from "../models/salesPoint.ts";
import applyOrderFinalizationToActorReport from "../dailySalesReports/applyOrderFinalizationToActorReport.ts";
import resolveFinalizationActorReportTarget from "../dailySalesReports/resolveFinalizationActorReportTarget.ts";
import { isIncrementalEngineEnabledForBusiness } from "../dailySalesReports/rolloutControls.ts";
import {
  recordActorUpdateFailure,
  recordActorUpdateSuccess,
  recordIdempotencySkip,
} from "../dailySalesReports/rolloutTelemetry.ts";

type SupportedFinalStatus = "Void" | "Invitation";

const finalizeOrdersBillingStatus = async (
  ordersIdsArr: Types.ObjectId[],
  salesInstanceId: Types.ObjectId,
  finalStatus: SupportedFinalStatus,
  session: ClientSession,
): Promise<true | string> => {
  try {
    const orders = (await Order.find({
      _id: { $in: ordersIdsArr },
      billingStatus: "Open",
      salesInstanceId,
    })
      .select(
        "_id salesInstanceId billingStatus orderNetPrice orderGrossPrice orderCostPrice dailyReferenceNumber businessId createdByUserId businessGoodId addOns",
      )
      .session(session)
      .lean()) as unknown as Pick<
      IOrder,
      | "_id"
      | "salesInstanceId"
      | "billingStatus"
      | "orderNetPrice"
      | "orderGrossPrice"
      | "orderCostPrice"
      | "dailyReferenceNumber"
      | "businessId"
      | "createdByUserId"
      | "businessGoodId"
      | "addOns"
    >[] | null;

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "No open orders found!";
    }

    const bulkUpdateOrders = orders.map((order) => ({
      updateOne: {
        filter: { _id: order._id, billingStatus: "Open" },
        update: { $set: { billingStatus: finalStatus } },
      },
    }));
    const bulkUpdateResult = await Order.bulkWrite(bulkUpdateOrders, { session });

    if (bulkUpdateResult.modifiedCount !== orders.length) {
      const skipped = orders.length - bulkUpdateResult.modifiedCount;
      if (skipped > 0) {
        recordIdempotencySkip(skipped, {
          salesInstanceId: String(salesInstanceId),
          finalStatus,
        });
      }
      return "Failed to update all orders!";
    }

    const salesInstance = (await SalesInstance.findById(salesInstanceId)
      .select("salesPointId")
      .session(session)
      .lean()) as { salesPointId?: Types.ObjectId } | null;
    if (!salesInstance?.salesPointId) {
      return "SalesInstance not found!";
    }

    const salesPoint = (await SalesPoint.findById(salesInstance.salesPointId)
      .select("salesPointType")
      .session(session)
      .lean()) as { salesPointType?: string } | null;
    const salesPointType = salesPoint?.salesPointType;

    for (const order of orders) {
      if (
        !isIncrementalEngineEnabledForBusiness(order.businessId as Types.ObjectId)
      ) {
        recordIdempotencySkip(1, {
          reason: "incremental_engine_disabled_for_business",
          businessId: String(order.businessId),
          finalStatus,
        });
        continue;
      }

      const goods: IGoodsReduced[] = [];
      if (order.businessGoodId) {
        goods.push({
          businessGoodId: order.businessGoodId,
          quantity: 1,
          totalPrice: order.orderGrossPrice,
          totalCostPrice: order.orderCostPrice,
        });
      }
      (order.addOns ?? []).forEach((addOnId) => {
        goods.push({ businessGoodId: addOnId, quantity: 1 });
      });

      const { targetBucket, employeeOnDuty } =
        await resolveFinalizationActorReportTarget({
          userId: order.createdByUserId as Types.ObjectId,
          businessId: order.businessId as Types.ObjectId,
          salesPointType,
          session,
        });

      const applyResult = await applyOrderFinalizationToActorReport({
        businessId: order.businessId as Types.ObjectId,
        dailyReferenceNumber: order.dailyReferenceNumber as number,
        order: {
          billingStatus: finalStatus,
          orderGrossPrice: order.orderGrossPrice,
          orderNetPrice: order.orderNetPrice,
          orderCostPrice: order.orderCostPrice,
          goods,
        },
        targetBucket,
        attribution: {
          userId: order.createdByUserId as Types.ObjectId,
          employeeOnDuty,
          salesPointType,
          salesPointId:
            targetBucket === "selfOrderingSalesReport"
              ? salesInstance.salesPointId
              : undefined,
        },
        session,
      });

      if (!applyResult.applied) {
        recordActorUpdateFailure({
          reason: applyResult.reason ?? "unknown_reason",
          orderId: String(order._id),
          businessId: String(order.businessId),
          finalStatus,
        });
        return `Failed to apply actor report update: ${applyResult.reason ?? "unknown reason"}`;
      }

      recordActorUpdateSuccess({
        orderId: String(order._id),
        businessId: String(order.businessId),
        finalStatus,
      });
    }

    return true;
  } catch (error) {
    return "Finalize orders billing status failed! Error: " + error;
  }
};

export default finalizeOrdersBillingStatus;
