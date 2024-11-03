import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { updateDynamicCountSupplierGood } from "../../inventories/utils/updateDynamicCountSupplierGood";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// ********** IMPORTANT **********
// This function will be call on the PATCH salesInstance route where you get all the orders

// order with status "Done" cannot be canceled
// only manager can cancel orders that havent been done yet
// user on GET /orders/:orderId
export const cancelOrders = async (
  ordersIdsArr: Types.ObjectId[],
  session: ClientSession
) => {
  try {
    // connect before first call to DB
    await connectDb();

    // Fetch all relevant orders at once using $in
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
    })
      .select("businessGoodsIds salesInstanceId orderStatus")
      .lean()
      .session(session);

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Some orders were not found!";
    }

    // Check if any of the orders are not allowed to be canceled
    if (orders.some((order) => order.orderStatus === "Done")) {
      return "Cannot cancel orders with status 'Done'!";
    }

    // Bulk update dynamic count for all business goods
    const businessGoodsIds = orders
      .map((order) => order.businessGoodsIds)
      .flat();
    // once you are canceling the order, the quantity of the business goods should be added back to the inventory
    const updateDynamicCountSupplierGoodResult =
      await updateDynamicCountSupplierGood(businessGoodsIds, "add", session);

    if (updateDynamicCountSupplierGoodResult !== true) {
      return (
        "updateDynamicCountSupplierGood error: " +
        updateDynamicCountSupplierGoodResult
      );
    }

    const [salesInstance1, salesInstance2, order] = await Promise.all([
      // Update sales instances in bulk
      SalesInstance.updateMany(
        {
          _id: orders[0].salesInstanceId,
          "salesGroup.ordersIds": { $in: ordersIdsArr },
        },
        { $pull: { "salesGroup.$.ordersIds": { $in: ordersIdsArr } } },
        { session }
      ),

      // Remove empty salesGroup objects
      SalesInstance.updateMany(
        { _id: orders[0].salesInstanceId },
        { $pull: { salesGroup: { ordersIds: { $size: 0 } } } },
        { session }
      ),

      // Delete orders in bulk
      Order.deleteMany({
        _id: { $in: ordersIdsArr },
      }).session(session),
    ]);

    if (salesInstance1.modifiedCount !== 1) {
      return "Cancel order failed, salesInstance not updated!";
    }

    if (order.deletedCount !== ordersIdsArr.length) {
      return "Cancel order failed, some orders were not deleted!";
    }

    return true;
  } catch (error) {
    return "Cancel order and update dynamic count failed! " + error;
  }
};
