import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { IOrder } from "@/app/lib/interface/IOrder";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// close multiple orders at the same time
export const closeOrders = async (
  ordersIdsArr: Types.ObjectId[],
  paymentMethodArr: IPaymentMethod[],
  session: ClientSession
) => {
  try {
    // Connect to DB
    await connectDb();

    // Fetch orders to be closed
    const orders: IOrder[] | null = await Order.find({
      _id: { $in: ordersIdsArr },
      billingStatus: "Open",
    })
      .select("salesInstanceId billingStatus orderNetPrice")
      .session(session)
      .lean();

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
      const orderPaymentMethods = [];

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
    const salesInstance: ISalesInstance | null = await SalesInstance.findById(
      orders[0].salesInstanceId
    )
      .select("responsibleById salesGroup")
      .populate({
        path: "salesGroup.ordersIds",
        select: "billingStatus",
        model: Order,
      })
      .session(session) // Use the same session
      .lean();

    if (!salesInstance) {
      return "SalesInstance not found!";
    }

    // Check if all orders in the sales instance are paid
    const allOrdersPaid = salesInstance?.salesGroup?.every((group) =>
      group.ordersIds.every((order: any) => order.billingStatus === "Paid")
    );

    // if they are all payed, close the sales instance
    if (allOrdersPaid) {
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: salesInstance._id },
        {
          salesInstanceStatus: "Closed",
          closedAt: new Date(),
          closedById: salesInstance.responsibleById,
        },
        { session }
      );

      if (updatedSalesInstance.modifiedCount !== 1) {
        return "Failed to close sales instance!";
      }
    }

    return true;
  } catch (error) {
    return "Close orders failed! Error: " + error;
  }
};
