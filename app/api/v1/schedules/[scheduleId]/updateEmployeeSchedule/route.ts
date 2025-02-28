import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { employeesValidation } from "../../utils/employeesValidation";
import isScheduleOverlapping from "../../utils/isScheduleOverlapping";
import getWeekdaysInMonth from "../../utils/getWeekDaysInMonth";
import calculateEmployeeCost from "../../utils/calculateEmployeeCost";

// imported interfaces
import { IEmployee } from "@/app/lib/interface/IEmployee";
import { IEmployeeSchedule, ISchedule } from "@/app/lib/interface/ISchedule";

// imported models
import Schedule from "@/app/lib/models/schedule";
import Employee from "@/app/lib/models/employee";

// @desc    Create new schedules
// @route   PATCH /schedules/:schedulesId/updateEmployeeSchedule
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  const { employeeSchedule, employeeScheduleId } = (await req.json()) as {
    employeeSchedule: IEmployeeSchedule;
    employeeScheduleId: Types.ObjectId;
  };

  const scheduleId = context.params.scheduleId;

  const { employeeId, role, timeRange, vacation } = employeeSchedule;
  const startTime = new Date(timeRange.startTime);
  const endTime = new Date(timeRange.endTime);

  // check if the schedule ID is valid
  if (isObjectIdValid([scheduleId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid schedule Id!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validate employee object
  const validEmployees = employeesValidation(employeeSchedule);
  if (validEmployees !== true) {
    return new NextResponse(JSON.stringify({ message: validEmployees }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch schedule and employee data concurrently
    const [schedule, employee] = await Promise.all([
      Schedule.findById(scheduleId)
        .select(
          "employeesSchedules._id employeesSchedules.employeeId employeesSchedules.vacation employeesSchedules.timeRange"
        )
        .lean<ISchedule | null>(),
      Employee.findById(employeeId)
        .select("salary.grossSalary salary.payFrequency")
        .lean<IEmployee | null>(),
    ]);

    if (!schedule) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Schedule not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!employee) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Employee not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find the specific employee schedule to update
    const employeeScheduleToUpdate = schedule.employeesSchedules.find(
      (empSch) => empSch._id.toString() === employeeScheduleId.toString()
    );

    if (!employeeScheduleToUpdate) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Employee schedule not found!",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the employee is scheduled more than once
    const employeeAlreadyScheduled = schedule.employeesSchedules.filter(
      (emp) =>
        emp.employeeId.toString() === employeeId.toString() &&
        emp._id.toString() !== employeeScheduleId.toString()
    );

    // if there are more than one schedule for the employee, it means he cant be on vacation
    if (employeeAlreadyScheduled.length > 0 && vacation) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Employee has multiple schedules, can't be on vacation!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // create on object for each schedule with start and end time
    const timeRangeArr = employeeAlreadyScheduled.map((el) => ({
      startTime: new Date(el.timeRange.startTime),
      endTime: new Date(el.timeRange.endTime),
    }));

    // the new schedule should not start or end inside an already scheduled shift
    if (timeRangeArr.length > 0) {
      if (isScheduleOverlapping(startTime, endTime, timeRangeArr)) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "Employee scheduled overlaps existing one!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Calculate difference in milliseconds
    const shiftDurationMs = endTime.getTime() - startTime.getTime();
    const weekdaysInMonth = getWeekdaysInMonth(
      new Date().getFullYear(),
      new Date().getMonth()
    );
    let employeeCost = 0;

    if (employee?.salary) {
      employeeCost = calculateEmployeeCost(
        employee.salary,
        shiftDurationMs,
        weekdaysInMonth
      );
    }

    // prepare the employee schedule update object
    const updateEmployeeSchedule = {
      _id: employeeScheduleId,
      employeeId,
      role,
      timeRange: {
        startTime,
        endTime,
      },
      vacation: vacation !== undefined ? vacation : false,
      shiftHours: shiftDurationMs,
      employeeCost,
    };

    const updatedSchedule = await Schedule.findOneAndUpdate(
      {
        _id: scheduleId,
        "employeesSchedules._id": employeeScheduleId, // Match the employee schedule by its _id
      },
      {
        $set: { "employeesSchedules.$": updateEmployeeSchedule }, // Use the positional operator to update the matched element
        $inc: {
          totalDayEmployeesCost: employeeCost,
          totalEmployeesScheduled:
            employeeScheduleToUpdate?.vacation && !vacation
              ? 1
              : employeeScheduleToUpdate?.vacation === false && vacation
              ? -1
              : 0,
          totalEmployeesVacation:
            employeeScheduleToUpdate?.vacation && !vacation
              ? -1
              : employeeScheduleToUpdate?.vacation === false && vacation
              ? 1
              : 0,
        },
      },
      { new: true, lean: true, session }
    );

    if (updatedSchedule) {
      const updatedEmployee = await Employee.findByIdAndUpdate(
        employeeId,
        {
          $inc: {
            vacationDaysLeft:
              employeeScheduleToUpdate?.vacation && !vacation
                ? 1
                : !employeeScheduleToUpdate?.vacation && vacation
                ? -1
                : 0,
          },
        },
        { new: true, lean: true, session }
      );

      if (!updatedEmployee) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message:
              "Update employee vacation days left failed upon adding employee to schedule!",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Employee schedule updated" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Updating employee to schedule failed!", error);
  } finally {
    session.endSession();
  }
};
