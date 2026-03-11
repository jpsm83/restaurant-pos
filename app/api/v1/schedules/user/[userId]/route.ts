import connectDb from "@/lib/db/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import Schedule from "@/lib/db/models/schedule";
import Employee from "@/lib/db/models/employee";
import User from "@/lib/db/models/user";

// @desc    Get all schedules where this user (as employee) appears
// @route   GET /api/v1/schedules/user/:userId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId };
  }
) => {
  try {
    const userId = context.params.userId;

    if (isObjectIdValid([userId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid user Id!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectDb();

    const user = (await User.findById(userId).select("employeeDetails").lean()) as { employeeDetails?: unknown } | null;
    if (!user?.employeeDetails) {
      return new NextResponse(
        JSON.stringify({ message: "User not found or not linked to an employee!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const employeeId = user.employeeDetails as Types.ObjectId;

    const schedules = await Schedule.find({
      "employeesSchedules.employeeId": employeeId,
    })
      .populate({
        path: "employeesSchedules.employeeId",
        select: "employeeName allEmployeeRoles",
        model: Employee,
      })
      .lean();

    return !schedules.length
      ? new NextResponse(JSON.stringify({ message: "No schedules found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(schedules), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get schedule by employee id failed!", error as string);
  }
};
