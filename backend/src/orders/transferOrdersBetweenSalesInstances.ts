import { ClientSession, Types } from "mongoose";
import Order from "../models/order.ts";
import SalesInstance from "../models/salesInstance.ts";

const transferOrdersBetweenSalesInstances = async (
  ordersIdsArr: Types.ObjectId[],
  fromSalesInstanceId: Types.ObjectId,
  toSalesInstanceId: Types.ObjectId,
  businessId: Types.ObjectId,
  session: ClientSession
): Promise<true | string> => {
  try {
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
      salesInstanceId: fromSalesInstanceId,
    })
      .select("salesInstanceId")
      .session(session)
      .lean();

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Some orders were not found!";
    }

    const toSalesInstance = await SalesInstance.findById(toSalesInstanceId)
      .select("businessId salesInstanceStatus")
      .session(session)
      .lean();

    if (!toSalesInstance) {
      return "Target sales instance not found!";
    }

    if (toSalesInstance.businessId.toString() !== businessId.toString()) {
      return "Target sales instance does not belong to this business!";
    }

    if (toSalesInstance.salesInstanceStatus === "Closed") {
      return "Cannot transfer orders to a closed sales instance!";
    }

    await Order.updateMany(
      { _id: { $in: ordersIdsArr }, salesInstanceId: fromSalesInstanceId },
      { $set: { salesInstanceId: toSalesInstanceId } },
      { session }
    );

    await SalesInstance.updateOne(
      { _id: fromSalesInstanceId, "salesGroup.ordersIds": { $in: ordersIdsArr } },
      { $pull: { "salesGroup.$.ordersIds": { $in: ordersIdsArr } } },
      { session }
    );

    await SalesInstance.updateOne(
      { _id: fromSalesInstanceId },
      { $pull: { salesGroup: { ordersIds: { $size: 0 } } } },
      { session }
    );

    const existingGroup = await SalesInstance.findOne({
      _id: toSalesInstanceId,
      "salesGroup.ordersIds": { $exists: true },
    })
      .select("salesGroup")
      .session(session)
      .lean();

    if (existingGroup && existingGroup.salesGroup && existingGroup.salesGroup.length > 0) {
      await SalesInstance.updateOne(
        { _id: toSalesInstanceId },
        { $push: { "salesGroup.0.ordersIds": { $each: ordersIdsArr } } },
        { session }
      );
    } else {
      await SalesInstance.updateOne(
        { _id: toSalesInstanceId },
        { $push: { salesGroup: { ordersIds: ordersIdsArr } } },
        { session }
      );
    }

    return true;
  } catch (error) {
    return "Transfer orders failed! Error: " + error;
  }
};

export default transferOrdersBetweenSalesInstances;