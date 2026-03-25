import { ClientSession, Types } from "mongoose";
import updateDynamicCountSupplierGood from "../inventories/updateDynamicCountSupplierGood.ts";
import Order from "../models/order.ts";
import SalesInstance from "../models/salesInstance.ts";

const cancelOrders = async (
  ordersIdsArr: Types.ObjectId[],
  salesInstanceId: Types.ObjectId,
  session: ClientSession
): Promise<true | string> => {
  try {
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
      salesInstanceId,
    })
      .select("businessGoodId addOns orderStatus")
      .lean()
      .session(session);

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Some orders were not found!";
    }

    if (orders.some((order) => order.orderStatus === "Done")) {
      return "Cannot cancel orders with status 'Done'!";
    }

    const businessGoodsIds = orders.flatMap((order) => [
      order.businessGoodId,
      ...(order.addOns ?? []),
    ]);

    const updateDynamicCountSupplierGoodResult =
      await updateDynamicCountSupplierGood(businessGoodsIds as Types.ObjectId[], "add", session);

    if (updateDynamicCountSupplierGoodResult !== true) {
      return (
        "updateDynamicCountSupplierGood error: " +
        updateDynamicCountSupplierGoodResult
      );
    }

    const salesInstance1 = await SalesInstance.updateMany(
      {
        _id: salesInstanceId,
        "salesGroup.ordersIds": { $in: ordersIdsArr },
      },
      { $pull: { "salesGroup.$.ordersIds": { $in: ordersIdsArr } } },
      { session },
    );

    const salesInstance2 = await SalesInstance.updateMany(
      { _id: salesInstanceId },
      { $pull: { salesGroup: { ordersIds: { $size: 0 } } } },
      { session },
    );

    const order = await Order.deleteMany({
      _id: { $in: ordersIdsArr },
    }).session(session);

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

export default cancelOrders;