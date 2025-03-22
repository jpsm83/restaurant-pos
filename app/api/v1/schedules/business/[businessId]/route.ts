import connectDb from "@/lib/db/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import { handleApiError } from "@/lib/db/handleApiError";

// imported models
import Schedule from "@/lib/db/models/schedule";
import Employee from "@/lib/db/models/employee";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// @desc    Get all schedules by business ID
// @route   GET /schedules/business/:businessId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // check if the schedule ID is valid
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business Id!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const schedules = await Schedule.find({ businessId: businessId })
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
    return handleApiError("Get schedule by business id failed!", error);
  }
};
