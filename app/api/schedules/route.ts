import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// imported interfaces
import { ISchedule } from "@/app/lib/interface/ISchedule";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { getWeekNumber } from "./utils/getWeekNumber";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Schedule from "@/app/lib/models/schedule";
import Employee from "@/app/lib/models/employee";

// @desc    Get all schedules
// @route   GET /schedules
// @access  Public
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const schedules = await Schedule.find()
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
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all schedules failed!", error);
  }
};

// first we create an empty day schedule object
// it will be populated with employee data using addEmployeeToSchedule
// @desc    Create a new schedule
// @route   POST /schedules
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { date, businessId, comments } = (await req.json()) as ISchedule;

    // validate business ID
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check required fields
    if (!date) {
      return new NextResponse(
        JSON.stringify({ message: "Date is required!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // get the week number
    // ***** THIS NUMBER IS THE YEAR FOLLOW BY THE WEEK NUMBER *****
    // ***** EXAMPLE: 202421 *****
    // This function calculates the week number of the year starting on Monday, following the ISO 8601 standard
    const weekNumber = getWeekNumber(new Date(date));

    // Extract year, month, and day from the date argument
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // getMonth() returns 0-based month
    const day = dateObj.getDate();

    // connect before first call to DB
    await connectDb();

    // Check if schedule already exists by comparing year, month, and day
    const duplicateSchedule = await Schedule.exists({
      businessId,
      $expr: {
        $and: [
          { $eq: [{ $year: "$date" }, year] },
          { $eq: [{ $month: "$date" }, month] },
          { $eq: [{ $dayOfMonth: "$date" }, day] },
        ],
      },
    });

    if (duplicateSchedule) {
      return new NextResponse(
        JSON.stringify({
          message: `Schedule for ${year}/${
            month > 9 ? month : "0" + month
          }/${day} already exists for business ${businessId}`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create schedule object
    const newSchedule = {
      date,
      weekNumber: weekNumber,
      businessId,
      comments: comments || undefined,
    };

    // create new schedule
    await Schedule.create(newSchedule);

    return new NextResponse(
      JSON.stringify({ message: `Schedule ${newSchedule.date} created!` }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create schedule failed!", error);
  }
};
