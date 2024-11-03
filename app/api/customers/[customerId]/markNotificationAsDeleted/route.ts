import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Customer from "@/app/lib/models/customer";
import Notification from "@/app/lib/models/notification";

// @desc    Create new customers
// @route   PATCH /customers/:customerId/markNotificationAsDeleted
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { customerId: Types.ObjectId };
  }
) => {
  // delete notification relation from customer.notifications
  const customerId = context.params.customerId;

  const { notificationId } = (await req.json()) as {
    notificationId: Types.ObjectId;
  };

  // validate customerId
  if (!isObjectIdValid([customerId, notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "Customer or notification ID is not valid!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // check notification exists
    const notificationExists = await Notification.exists({
      _id: notificationId,
    });

    if (!notificationExists) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // customer can mark notification as deleted but never delete it for data integrity
    const updatedCustomer = await Customer.updateOne(
      { _id: customerId, "notifications.notificationId": notificationId },
      {
        $set: {
          "notifications.$.deletedFlag": true,
          "notifications.$.readFlag": true,
        },
      },
      { session }
    );

    // Check if the updates were successful
    if (updatedCustomer.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Customer not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Customer notification mark as deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Update notification read flag from customer failed!",
      error
    );
  } finally {
    session.endSession();
  }
};
