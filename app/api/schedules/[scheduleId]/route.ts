import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported interfaces
import { ISchedule } from "@/app/lib/interface/ISchedule";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Schedule from "@/app/lib/models/schedule";
import Employee from "@/app/lib/models/employee";

// @desc    Get schedule by ID
// @route   GET /schedules/:scheduleId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (isObjectIdValid([scheduleId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const schedule = await Schedule.findById(scheduleId)
      .populate({
        path: "employeesSchedules.employeeId",
        select: "employeeName allEmployeeRoles",
        model: Employee,
      })
      .lean();

    return !schedule
      ? new NextResponse(JSON.stringify({ message: "No schedule found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(schedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get schedule by its id failed!", error);
  }
};

// the only thing we can update is the comments
// @desc    Update a schedule
// @route   PATCH /schedules/:scheduleId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const scheduleId = context.params.scheduleId;

    // check if the schedule ID is valid
    if (isObjectIdValid([scheduleId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { comments } = (await req.json()) as ISchedule;

    // connect before first call to DB
    await connectDb();

    // prepare update object
    const updateSchedule: Partial<ISchedule> = {};

    if (comments) {
      updateSchedule.comments = comments;
    }

    // Update the schedule using findByIdAndUpdate
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      { $set: updateSchedule },
      { new: true, lean: true }
    );

    if (!updatedSchedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(JSON.stringify({ message: "Schedule updated" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Update schedule failed!", error);
  }
};

// @desc    Delete a schedule
// @route   DELETE /schedules/:scheduleId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (isObjectIdValid([scheduleId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if schedule date is before the current date
    const schedule: ISchedule | null = await Schedule.findById(
      scheduleId
    ).lean();
    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const scheduleDate = new Date(schedule.date);
    const currentDate = new Date();

    // Reset time to midnight for comparison
    scheduleDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    if (scheduleDate <= currentDate) {
      return new NextResponse(
        JSON.stringify({ message: "Cannot delete past or current schedules!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    // delete schedule and check if it existed
    const result = await Schedule.deleteOne({ _id: scheduleId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Schedule ${scheduleId} deleted` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete schedule failed!", error);
  }
};
