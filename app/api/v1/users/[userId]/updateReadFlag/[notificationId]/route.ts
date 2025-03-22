import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import User from "@/lib/db/models/user";
import Notification from "@/lib/db/models/notification";

// @desc    Create new customers
// @route   PATCH /customers/:customerId/updateReadFlag/:notificationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { customerId: Types.ObjectId; notificationId: Types.ObjectId };
  }
) => {
  // update notification readFlag from user
  try {
    const { customerId, notificationId } = context.params;

    // validate customerId
    if (!isObjectIdValid([customerId, notificationId])) {
      return new NextResponse(
        JSON.stringify({
          message: "User or notification ID is not valid!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check notification exists
    const notificationExists = await Notification.exists({
      _id: notificationId,
    });

    if (!notificationExists) {
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Update the readFlag for the specific notification
    const updatedCustomer = await User.findOneAndUpdate(
      {
        _id: customerId,
        "notifications.notificationId": notificationId,
      },
      { $set: { "notifications.$.readFlag": true } },
      { new: true, lean: true }
    );
    

    // Check if the purchase was found and updated
    if (!updatedCustomer) {
      return new NextResponse(
        JSON.stringify({ message: "User notification not updated!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `User notification updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Update notification read flag from user failed!",
      error as string
    );
  }
};
