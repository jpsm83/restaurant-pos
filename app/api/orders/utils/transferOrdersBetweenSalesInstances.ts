import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// employee can transfer orders between only the salesInstances that are not closed and resposibleById belongs to hin
export const transferOrdersBetweenSalesInstances = async (
  ordersIdsArr: Types.ObjectId[],
  toSalesInstanceId: Types.ObjectId,
  session: ClientSession
) => {
  try {
    // connect before first call to DB
    await connectDb();

    // Step 1: Verify the target sales instance is open and get its data
    const targetSalesInstance: ISalesInstance | null =
      await SalesInstance.findOne({
        _id: toSalesInstanceId,
        salesInstanceStatus: { $ne: "Closed" },
      })
        .select("_id salesGroup")
        .session(session)
        .lean();

    if (!targetSalesInstance) {
      return "Target SalesInstance not found or is closed!";
    }

    // Step 2: Verify all orders are open and retrieve their current salesInstanceId
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
      billingStatus: "Open",
    })
      .select("salesInstanceId")
      .session(session)
      .lean();

    // check if all orders are open
    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Some orders are not open!";
    }

    // Fetch the original salesInstance
    const originalSalesInstance = await SalesInstance.findOne({
      _id: orders[0].salesInstanceId,
      "salesGroup.ordersIds": { $in: ordersIdsArr },
    })
      .select("salesGroup")
      .session(session);

    if (!originalSalesInstance) {
      return "Original SalesInstance or sales group not found!";
    }

    // Step 4: Prepare the bulk update for transferring orders
    const bulkUpdateOrders = ordersIdsArr.map((orderId) => ({
      updateOne: {
        filter: { _id: orderId },
        update: { $set: { salesInstanceId: toSalesInstanceId } },
      },
    }));

    // Step 5: Execute all database operations in parallel
    const [orderBulk, salesInstanceUpdate1, salesInstanceUpdate2, moveOrders] =
      await Promise.all([
        // Bulk update orders' salesInstanceId
        Order.bulkWrite(bulkUpdateOrders, { session }),

        // Remove orders from the original sales group
        SalesInstance.updateOne(
          { _id: originalSalesInstance._id },
          { $pull: { "salesGroup.$[].ordersIds": { $in: ordersIdsArr } } },
          { session }
        ),

        // Remove empty salesGroup objects if any ordersIds array becomes empty
        SalesInstance.updateOne(
          { _id: originalSalesInstance._id },
          { $pull: { salesGroup: { ordersIds: { $size: 0 } } } },
          { session }
        ),

        // Add orders to the target sales instance's salesGroup
        moveOrdersToTargetSalesInstance(
          targetSalesInstance,
          ordersIdsArr,
          originalSalesInstance.salesGroup,
          session
        ),
      ]);

    // check if bulk update was successful
    if (orderBulk.modifiedCount !== ordersIdsArr.length) {
      return "OrderBulk failed!";
    }

    // check if salesInstanceUpdate1 was successful
    if (salesInstanceUpdate1.modifiedCount !== 1) {
      return "SalesInstanceUpdate1 failed!";
    }

    // check if salesInstanceUpdate2 was successful
    if (salesInstanceUpdate2.modifiedCount !== 1) {
      return "SalesInstanceUpdate2 failed!";
    }

    // check if moveOrders was successful
    if (moveOrders !== true) {
      return moveOrders;
    }

    return true;
  } catch (error) {
    return "Transfer orders between salesInstances failed! Error: " + error;
  }
};

// Helper function to move orders to target salesInstance salesGroup
const moveOrdersToTargetSalesInstance = async (
  targetSalesInstance: ISalesInstance,
  ordersIdsArr: Types.ObjectId[],
  originalSalesGroups: any[],
  session: ClientSession
) => {
  // Iterate through the original sales groups to match order codes and transfer
  for (const group of originalSalesGroups) {
    const { orderCode, createdAt } = group;

    // Check if target salesInstance already has a matching salesGroup by orderCode
    const existingGroup =
      targetSalesInstance.salesGroup &&
      targetSalesInstance.salesGroup.find((g) => g.orderCode === orderCode);

    if (existingGroup) {
      // Add orders to the existing salesGroup
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: targetSalesInstance._id, "salesGroup.orderCode": orderCode },
        { $addToSet: { "salesGroup.$.ordersIds": { $each: ordersIdsArr } } },
        { session }
      );

      if (updatedSalesInstance.modifiedCount !== 1) {
        await session.abortTransaction();
        return "Failed to add orders to existing salesGroup!";
      }
    } else {
      // Add a new salesGroup if no matching group by orderCode
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: targetSalesInstance._id },
        {
          $push: {
            salesGroup: {
              orderCode,
              ordersIds: ordersIdsArr,
              createdAt,
            },
          },
        },
        { session }
      );
      if (updatedSalesInstance.modifiedCount !== 1) {
        await session.abortTransaction();
        return "Failed to add orders to new salesGroup!";
      }
    }
  }
  return true;
};
