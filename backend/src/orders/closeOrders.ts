import { ClientSession, Types } from "mongoose";
import type { IOrder } from "restaurant-pos-packages/interfaces/IOrder";
import type { ISalesInstance } from "restaurant-pos-packages/interfaces/ISalesInstance";
import type { IPaymentMethod } from "restaurant-pos-packages/interfaces/IPaymentMethod";
import type { IGoodsReduced } from "restaurant-pos-packages/interfaces/IDailySalesReport";
import Order from "../models/order.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import SalesInstance from "../models/salesInstance.ts";
import SalesPoint from "../models/salesPoint.ts";
import Reservation from "../models/reservation.ts";
import applyOrderFinalizationToActorReport from "../dailySalesReports/applyOrderFinalizationToActorReport.ts";
import resolveFinalizationActorReportTarget from "../dailySalesReports/resolveFinalizationActorReportTarget.ts";
import { isIncrementalEngineEnabledForBusiness } from "../dailySalesReports/rolloutControls.ts";
import {
  recordActorUpdateFailure,
  recordActorUpdateSuccess,
  recordIdempotencySkip,
} from "../dailySalesReports/rolloutTelemetry.ts";

const closeOrders = async (
  ordersIdsArr: Types.ObjectId[],
  paymentMethodArr: IPaymentMethod[],
  salesInstanceId: Types.ObjectId,
  session: ClientSession
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

    const totalOrderNetPrice = orders
      ? orders.reduce((acc, order) => acc + order.orderNetPrice, 0)
      : 0;
    const totalPaid = paymentMethodArr.reduce(
      (acc, payment) => acc + (payment.methodSalesTotal || 0),
      0
    );

    if (totalPaid < totalOrderNetPrice) {
      return "Total amount paid is lower than the total price of the orders!";
    }

    const totalTips = totalPaid - totalOrderNetPrice;
    let remainingTips = totalTips;

    const finalizedOrders = orders.map((order, index) => {
      let remainingOrderNetPrice = order.orderNetPrice;
      const orderPaymentMethods: IPaymentMethod[] = [];

      for (const payment of paymentMethodArr) {
        if (payment.methodSalesTotal <= 0) continue;

        const amountToUse = Math.min(
          payment.methodSalesTotal,
          remainingOrderNetPrice
        );

        orderPaymentMethods.push({
          paymentMethodType: payment.paymentMethodType,
          methodBranch: payment.methodBranch,
          methodSalesTotal: amountToUse,
        });

        payment.methodSalesTotal -= amountToUse;
        remainingOrderNetPrice -= amountToUse;

        if (remainingOrderNetPrice === 0) break;
      }

      const updateData: Partial<IOrder> = {
        paymentMethod: orderPaymentMethods,
        billingStatus: "Paid",
      };

      if (index === 0 && remainingTips > 0) {
        updateData.orderTips = remainingTips;
        remainingTips = 0;
      }

      return { order, updateData };
    });

    const bulkUpdateOrders = finalizedOrders.map(({ order, updateData }) => ({
      updateOne: {
        filter: withSoftDeleteFilter({
          _id: order._id,
          billingStatus: "Open",
        }),
        update: { $set: updateData },
      },
    }));

    const bulkUpdateResult = await Order.bulkWrite(bulkUpdateOrders, {
      session,
    });

    if (bulkUpdateResult.modifiedCount !== orders.length) {
      const skipped = orders.length - bulkUpdateResult.modifiedCount;
      if (skipped > 0) {
        recordIdempotencySkip(skipped, {
          salesInstanceId: String(salesInstanceId),
        });
      }
      return "Failed to update all orders!";
    }

    const salesInstance = (await SalesInstance.findById(salesInstanceId)
      .select("responsibleByUserId salesGroup reservationId salesPointId")
      .populate({
        path: "salesGroup.ordersIds",
        select: "billingStatus",
        model: Order,
        // The group can still list an order that was marked deleted. This
        // check has to see that row; the active-only hook would drop it.
        options: { includeDeleted: true },
      })
      .session(session)
      .lean()) as unknown as ISalesInstance | null;

    if (!salesInstance) {
      return "SalesInstance not found!";
    }

    const salesPoint = (await SalesPoint.findById(salesInstance.salesPointId)
      .select("salesPointType")
      .session(session)
      .lean()) as { salesPointType?: string } | null;
    const salesPointType = salesPoint?.salesPointType;

    for (const { order, updateData } of finalizedOrders) {
      if (
        !isIncrementalEngineEnabledForBusiness(order.businessId as Types.ObjectId)
      ) {
        recordIdempotencySkip(1, {
          reason: "incremental_engine_disabled_for_business",
          businessId: String(order.businessId),
        });
        continue;
      }

      const goods: IGoodsReduced[] = [];
      if (order.businessGoodId) {
        goods.push({ businessGoodId: order.businessGoodId, quantity: 1 });
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
          billingStatus: "Paid",
          orderGrossPrice: order.orderGrossPrice,
          orderNetPrice: order.orderNetPrice,
          orderTips: updateData.orderTips,
          orderCostPrice: order.orderCostPrice,
          paymentMethod: updateData.paymentMethod,
          goods,
        },
        targetBucket,
        attribution: {
          userId: order.createdByUserId as Types.ObjectId,
          employeeOnDuty,
          salesPointType,
          salesPointId:
            targetBucket === "selfOrderingSalesReport"
              ? (salesInstance.salesPointId as Types.ObjectId)
              : undefined,
        },
        session,
      });

      if (!applyResult.applied) {
        recordActorUpdateFailure({
          reason: applyResult.reason ?? "unknown_reason",
          orderId: String(order._id),
          businessId: String(order.businessId),
        });
        return `Failed to apply actor report update: ${applyResult.reason ?? "unknown reason"}`;
      }
      recordActorUpdateSuccess({
        orderId: String(order._id),
        businessId: String(order.businessId),
      });
    }

    const allOrdersPaid = salesInstance?.salesGroup?.every((group) =>
      group.ordersIds.every(
        (order: Partial<IOrder> | null) => order?.billingStatus === "Paid"
      )
    );

    if (allOrdersPaid) {
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: salesInstance._id },
        {
          salesInstanceStatus: "Closed",
          closedAt: new Date(),
          closedByUserId: salesInstance.responsibleByUserId,
        },
        { session }
      );

      if (updatedSalesInstance.modifiedCount !== 1) {
        return "Failed to close sales instance!";
      }

      const reservation = (await Reservation.findOne({
        $or: [{ salesInstanceId: salesInstance._id }, { _id: salesInstance.reservationId }],
      })
        .select("_id status")
        .session(session)
        .lean()) as unknown as { _id: Types.ObjectId; status?: string } | null;

      if (reservation && reservation.status !== "Cancelled" && reservation.status !== "NoShow") {
        await Reservation.updateOne(
          { _id: reservation._id },
          { $set: { status: "Completed" } },
          { session }
        );
      }
    }

    return true;
  } catch (error) {
    return "Close orders failed! Error: " + error;
  }
};

export default closeOrders;