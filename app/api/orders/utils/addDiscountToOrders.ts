import { Types, ClientSession } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported models
import Order from "@/app/lib/models/order";

// ********** IMPORTANT **********
// This function will be call on the PATCH salesInstance route where you get all the orders

// add discount to multiple orders at the same time if promotion is not applied
// only used for emplloyees orders not sef ordering
// ******** NOT USED ANYWHERE YET ********
export const addDiscountToOrders = async (
  ordersIdsArr: Types.ObjectId[],
  discountPercentage: number,
  comments: string,
  session: ClientSession
) => {
  // validate required fields
  if (!comments) {
    return "Comments are required for discounts!";
  }

  // validate discount percentage
  if (discountPercentage > 100 || discountPercentage < 0) {
    return "Discount value has to be a number between 0 and 100!";
  }

  try {
    // connect before first call to DB
    await connectDb();

    // Fetch all relevant orders at once using $in
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
    })
      .select("promotionApplyed orderGrossPrice billingStatus")
      .lean()
      .session(session);

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Some orders were not found!";
    }

    // do not add discount if promotion applyed
    if (orders.some((order) => order.promotionApplyed)) {
      return "You cannot add discount to an order that has a promotion already!";
    }

    // do not add discount if order is not open
    if (orders.some((order) => order.billingStatus !== "Open")) {
      return "Some orders are not open to apply a discount!";
    }

    // Prepare bulk update operations for all orders
    const bulkUpdateOperations = orders.map((order) => {
      const newNetPrice =
        order.orderGrossPrice -
        (order.orderGrossPrice * discountPercentage) / 100;

      return {
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              orderNetPrice: newNetPrice,
              discountPercentage,
              comments,
            },
          },
        },
      };
    });

    // Execute bulk update
    const bulkResult = await Order.bulkWrite(bulkUpdateOperations, {
      session,
    });

    if (bulkResult.ok !== 1) {
      return "Bulk update failed!";
    }

    return true;
  } catch (error) {
    return "Add discount to orders failed! " + error;
  }
};
