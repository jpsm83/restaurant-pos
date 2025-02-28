import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported models
import Order from "@/app/lib/models/order";

// ********** IMPORTANT **********
// This function will be call on the PATCH salesInstance route where you get all the orders

// order can be change in the following order: sent -> done -> delivered
// orders with status "Dont Make" cannot be changed
// only manager can change order status out of order
// kitchen staff set order to "Done"
// Floor staff set order to "Sent" after holding it
// Floor staff set order to "Delivered" after order is delivered (if delivery is enabled)
// ******** NOT USED ANYWHERE YET ********
export const changeOrdersStatus = async (
  ordersIdsArr: Types.ObjectId[],
  ordersNewStatus: string,
  session: ClientSession
) => {
  try {
    // connect before first call to DB
    await connectDb();

    // Fetch all relevant orders at once using $in
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
    })
      .select("orderStatus")
      .lean()
      .session(session);

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Some orders were not found!";
    }

    // check if orders can be changed to new status
    if (orders.some((order) => order.orderStatus === "Dont Make")) {
      return "Dont make orders cannot be changed!";
    }

    // Update order status in bulk, excluding "Dont Make"
    const updatedOrder = await Order.updateMany(
      { _id: { $in: ordersIdsArr } },
      { $set: { orderStatus: ordersNewStatus } },
      { session }
    );

    if (updatedOrder.modifiedCount === 0) {
      return "No orders were updated!";
    }

    return true;
  } catch (error) {
    return "Change orders status failed! " + error;
  }
};
