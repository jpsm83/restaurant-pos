import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Employee from "@/app/lib/models/employee";
import Notification from "@/app/lib/models/notification";

// @desc    Create new employees
// @route   PATCH /employees/:employeeId/updateReadFlag/:notificationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { employeeId: Types.ObjectId; notificationId: Types.ObjectId };
  }
) => {
  // update notification readFlag from employee
  try {
    const { employeeId, notificationId } = context.params;

    // validate employeeId
    if (!isObjectIdValid([employeeId, notificationId])) {
      return new NextResponse(
        JSON.stringify({
          message: "Employee or notification ID is not valid!",
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
    const updatedEmployee = await Employee.findOneAndUpdate(
      {
        _id: employeeId,
        "notifications.notificationId": notificationId,
      },
      { $set: { "notifications.$.readFlag": true } },
      { new: true, lean: true }
    );

    // Check if the purchase was found and updated
    if (!updatedEmployee) {
      return new NextResponse(
        JSON.stringify({ message: "Employee notification not updated!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Employee notification updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Update notification read flag from employee failed!",
      error
    );
  }
};
