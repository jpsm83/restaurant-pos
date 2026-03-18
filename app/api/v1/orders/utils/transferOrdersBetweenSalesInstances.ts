import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";

// imported interfaces
import { ISalesInstance } from "@shared/interfaces/ISalesInstance";

// imported models
import Order from "@/lib/db/models/order";
import SalesInstance from "@/lib/db/models/salesInstance";

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
    const targetSalesInstance = (await SalesInstance.findOne({
      _id: toSalesInstanceId,
      salesInstanceStatus: { $ne: "Closed" },
    })
      .select(
        "_id salesGroup salesPointId guests salesInstanceStatus businessId"
      )
      .session(session)
      .lean()) as unknown as ISalesInstance | null;

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
    })
      // .select("salesGroup")
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
    const [orderBulk, salesInstanceUpdate1] = await Promise.all([
      Order.bulkWrite(bulkUpdateOrders, { session }),

      // Remove orders from the original sales group
      SalesInstance.updateOne(
        { _id: originalSalesInstance._id },
        { $pull: { "salesGroup.$[].ordersIds": { $in: ordersIdsArr } } },
        { session }
      ),
    ]);

    if (orderBulk.modifiedCount !== ordersIdsArr.length) {
      return "OrderBulk failed!";
    }

    if (salesInstanceUpdate1.modifiedCount !== 1) {
      console.log("salesInstanceUpdate1 did not modify any documents.");
      return "SalesInstanceUpdate1 failed!";
    }

    // Now remove empty sales groups
    const salesInstanceUpdate2 = await SalesInstance.updateMany(
      { _id: originalSalesInstance._id },
      { $pull: { salesGroup: { ordersIds: { $size: 0 } } } },
      { session }
    );

    if (salesInstanceUpdate2.modifiedCount === 0) {
      console.log("No empty sales groups were removed.");
    }

    // Add orders to the target sales instance's salesGroup
    const moveOrders = await moveOrdersToTargetSalesInstance(
      targetSalesInstance,
      ordersIdsArr,
      originalSalesInstance.salesGroup,
      session
    );

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
  originalSalesGroups: {
    orderCode: string;
    createdAt: Date;
    ordersIds: Types.ObjectId[];
  }[],
  session: ClientSession
) => {
  // Iterate through the orders to move them to the correct salesGroup
  for (const orderId of ordersIdsArr) {
    // Find the original sales group that contains the orderId
    const orderGroup = originalSalesGroups.find(
      (group) => group.ordersIds && group.ordersIds.includes(orderId) // Ensure ordersIds is defined
    );

    if (!orderGroup) {
      continue; // Skip if no matching orderGroup found for the orderId
    }

    const { orderCode, createdAt } = orderGroup;

    // Check if target salesInstance already has a matching salesGroup by orderCode
    const existingGroup = targetSalesInstance.salesGroup?.find(
      (g) => g.orderCode === orderCode
    );

    if (existingGroup) {
      // Add the orderId to the existing salesGroup
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: targetSalesInstance._id, "salesGroup.orderCode": orderCode },
        { $addToSet: { "salesGroup.$.ordersIds": orderId } },
        { session }
      );

      if (updatedSalesInstance.modifiedCount !== 1) {
        await session.abortTransaction();
        return "Failed to add order to existing salesGroup!";
      }
    } else {
      // Add a new salesGroup if no matching group by orderCode
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: targetSalesInstance._id },
        {
          $push: {
            salesGroup: {
              orderCode,
              ordersIds: [orderId], // Push the individual orderId as an array
              createdAt,
            },
          },
        },
        { session }
      );

      if (updatedSalesInstance.modifiedCount !== 1) {
        await session.abortTransaction();
        return "Failed to add new salesGroup with order!";
      }
    }
  }

  return true;
};
