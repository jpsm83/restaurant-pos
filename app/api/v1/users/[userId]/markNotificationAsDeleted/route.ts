import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import User from "@/lib/db/models/user";
import Notification from "@/lib/db/models/notification";

// @desc    Create new customers
// @route   PATCH /customers/:customerId/markNotificationAsDeleted
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { customerId: Types.ObjectId };
  }
) => {
  // delete notification relation from user.notifications
  const customerId = context.params.customerId;

  const { notificationId } = (await req.json()) as {
    notificationId: Types.ObjectId;
  };

  // validate customerId
  if (!isObjectIdValid([customerId, notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "User or notification ID is not valid!" }),
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

    // user can mark notification as deleted but never delete it for data integrity
    const updatedCustomer = await User.findOneAndUpdate(
      { _id: customerId, "notifications.notificationId": notificationId },
      {
        $set: {
          "notifications.$.deletedFlag": true,
          "notifications.$.readFlag": true,
        },
      },
      { new: true, lean: true, session }
    );

    // Check if the updates were successful
    if (!updatedCustomer) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "User not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `User notification mark as deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Update notification read flag from user failed!",
      error as string
    );
  } finally {
    session.endSession();
  }
};
