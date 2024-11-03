import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Schedule from "@/app/lib/models/schedule";
import Employee from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Get all schedules by employee ID
// @route   GET /schedules/employee/:employeeId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { employeeId: Types.ObjectId };
  }
) => {
  try {
    const employeeId = context.params.employeeId;

    // check if the schedule ID is valid
    if (isObjectIdValid([employeeId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid employee Id!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

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
    return handleApiError("Get schedule by employee id failed!", error);
  }
};
