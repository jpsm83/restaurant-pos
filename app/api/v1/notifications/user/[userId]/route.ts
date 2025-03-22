import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import Notification from "@/lib/db/models/notification";
import Employee from "@/lib/db/models/employee";
import Customer from "@/app/lib/models/customer";

// @desc    Get all notifications by employee ID
// @route   GET /notifications/employee/:employeeId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { employeeId: Types.ObjectId };
  }
) => {
  const employeeId = context.params.employeeId;

  if (!isObjectIdValid([employeeId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid business ID!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    const notifications = await Notification.find({
      recipientsId: employeeId,
    })
      .populate({
        path: "employeesRecipientsIds",
        select: "employeeName",
        model: Employee,
      })
      .populate({
        path: "customersRecipientsIds",
        select: "customerName",
        model: Customer,
      })
      .lean();

    return !notifications.length
      ? new NextResponse(
          JSON.stringify({ message: "No notifications found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(notifications), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get employees by business id failed!", error);
  }
};
