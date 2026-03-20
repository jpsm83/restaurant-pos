import { ClientSession, Types } from "mongoose";
import type { IOrder } from "../../../lib/interface/IOrder.ts";
import type { ISalesInstance } from "../../../lib/interface/ISalesInstance.ts";
import type { IPaymentMethod } from "../../../lib/interface/IPaymentMethod.ts";
import Order from "../models/order.ts";
import SalesInstance from "../models/salesInstance.ts";
import Reservation from "../models/reservation.ts";

const closeOrders = async (
  ordersIdsArr: Types.ObjectId[],
  paymentMethodArr: IPaymentMethod[],
  session: ClientSession
): Promise<true | string> => {
  try {
    const orders = (await Order.find({
      _id: { $in: ordersIdsArr },
      billingStatus: "Open",
    })
      .select("_id salesInstanceId billingStatus orderNetPrice")
      .session(session)
      .lean()) as unknown as Pick<
      IOrder,
      "_id" | "salesInstanceId" | "billingStatus" | "orderNetPrice"
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

    const bulkUpdateOrders = orders.map((order, index) => {
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

      return {
        updateOne: {
          filter: { _id: order._id },
          update: { $set: updateData },
        },
      };
    });

    const bulkUpdateResult = await Order.bulkWrite(bulkUpdateOrders, {
      session,
    });

    if (bulkUpdateResult.modifiedCount !== orders.length) {
      return "Failed to update all orders!";
    }

    const salesInstance = (await SalesInstance.findById(orders[0].salesInstanceId)
      .select("responsibleByUserId salesGroup reservationId")
      .populate({
        path: "salesGroup.ordersIds",
        select: "billingStatus",
        model: Order,
      })
      .session(session)
      .lean()) as unknown as ISalesInstance | null;

    if (!salesInstance) {
      return "SalesInstance not found!";
    }

    const allOrdersPaid = salesInstance?.salesGroup?.every((group) =>
      group.ordersIds.every(
        (order: Partial<IOrder>) => order.billingStatus === "Paid"
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