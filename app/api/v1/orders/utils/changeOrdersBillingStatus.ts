import { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported models
import Order from "@/app/lib/models/order";

// ********** IMPORTANT **********
// This function will be call on the PATCH salesInstance route where you get all the orders

// Void, Cancel and Invitation can be manually changed by managers
// Paid is automatically changed by the system
// Open is the default status
// ******** NOT USED ANYWHERE YET ********
export const changeOrdersBillingStatus = async (
  ordersIdsArr: Types.ObjectId[],
  ordersNewBillingStatus: string,
  session: ClientSession
) => {
  // here you not allowed to change the billing status to Paid or Cancel
  // those status are automatically changed by the system

  // billingStatus are Open, Paid, Void, Cancel and Invitation
  const notAllowedBillingStatus = ["Paid", "Cancel"];

  // validate not all
  if (notAllowedBillingStatus.includes(ordersNewBillingStatus)) {
    return `Billing status cannot be manually changed to ${ordersNewBillingStatus}!`;
  }

  try {
    // connect before first call to DB
    await connectDb();

    // Fetch all relevant orders at once using $in
    const orders = await Order.find({
      _id: { $in: ordersIdsArr },
    })
      .select("billingStatus orderGrossPrice")
      .lean()
      .session(session);

    if (!orders || orders.length !== ordersIdsArr.length) {
      return "Orders were not found!";
    }

    // check if orders has the billing status as open, invitation, void
    const allowedToChange = ["Open", "Invitation", "Void"];

    if (
      orders.some((order) => !allowedToChange.includes(order.billingStatus))
    ) {
      return "Only orders open, invitation or void can have the billing status change manually!";
    }

    const bulkWriteOperations = orders.map((order) => ({
      updateOne: {
        filter: { _id: order._id },
        update: {
          billingStatus: ordersNewBillingStatus,
          orderNetPrice:
            ordersNewBillingStatus === "Open" ? order.orderGrossPrice : 0,
        },
      },
    }));

    const bulkResult = await Order.bulkWrite(bulkWriteOperations, { session });

    if (bulkResult.ok !== 1) {
      return "Bulk write failed!";
    }

    return true;
  } catch (error) {
    return "Change orders status failed! " + error;
  }
};
