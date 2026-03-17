import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";

// imported interfaces
import { IOrder } from "@/lib/interface/IOrder";
import { ISalesInstance } from "@/lib/interface/ISalesInstance";
import { IPaymentMethod } from "@/lib/interface/IPaymentMethod";

// imported models
import Order from "@/lib/db/models/order";
import SalesInstance from "@/lib/db/models/salesInstance";
import Reservation from "@/lib/db/models/reservation";

// close multiple orders at the same time
export const closeOrders = async (
  ordersIdsArr: Types.ObjectId[],
  paymentMethodArr: IPaymentMethod[],
  session: ClientSession
) => {
  try {
    // Connect to DB
    await connectDb();

    // Fetch orders to be closed (stored prices are trusted; no promotion re-validation)
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

    // Calculate total order net price and total paid
    const totalOrderNetPrice = orders
      ? orders.reduce((acc, order) => acc + order.orderNetPrice, 0)
      : 0;
    const totalPaid = paymentMethodArr.reduce(
      (acc, payment) => acc + (payment.methodSalesTotal || 0),
      0
    );

    // Check if total paid is lower than the total orders
    if (totalPaid < totalOrderNetPrice) {
      return "Total amount paid is lower than the total price of the orders!";
    }

    // Calculate total tips and remaining tips
    const totalTips = totalPaid - totalOrderNetPrice;
    let remainingTips = totalTips;

    // Process each order in a single loop
    const bulkUpdateOrders = orders.map((order, index) => {
      let remainingOrderNetPrice = order.orderNetPrice;
      const orderPaymentMethods: IPaymentMethod[] = [];

      for (const payment of paymentMethodArr) {
        if (payment.methodSalesTotal <= 0) continue;

        const amountToUse = Math.min(
          payment.methodSalesTotal,
          remainingOrderNetPrice
        );

        // Add the payment details to the order
        orderPaymentMethods.push({
          paymentMethodType: payment.paymentMethodType,
          methodBranch: payment.methodBranch,
          methodSalesTotal: amountToUse,
        });

        payment.methodSalesTotal -= amountToUse;
        remainingOrderNetPrice -= amountToUse;

        if (remainingOrderNetPrice === 0) break;
      }

      // Prepare update data for each order
      const updateData: Partial<IOrder> = {
        paymentMethod: orderPaymentMethods,
        billingStatus: "Paid",
      };

      // Add tips to the first order
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

    // Bulk update all orders
    const bulkUpdateResult = await Order.bulkWrite(bulkUpdateOrders, {
      session,
    });

    if (bulkUpdateResult.modifiedCount !== orders.length) {
      return "Failed to update all orders!";
    }

    // Fetch sales instance associated with the first order
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

      // If this salesInstance is linked to a reservation, mark reservation as Completed.
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
