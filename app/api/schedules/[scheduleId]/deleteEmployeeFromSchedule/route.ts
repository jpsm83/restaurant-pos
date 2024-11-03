import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IEmployeeSchedule, ISchedule } from "@/app/lib/interface/ISchedule";

// imported models
import Schedule from "@/app/lib/models/schedule";
import Employee from "@/app/lib/models/employee";

// @desc    Create new schedules
// @route   PATCH /schedules/:schedulesId/deleteEmployeeFromSchedule
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  // delete employee from schedule
  try {
    // we beed employeeScheduleId because one employee can be duplicated in the schedule
    const { employeeId, employeeScheduleId } = (await req.json()) as {
      employeeId: Types.ObjectId;
      employeeScheduleId: Types.ObjectId;
    };

    const scheduleId = context.params.scheduleId;

    // check if the schedule ID is valid
    if (
      isObjectIdValid([scheduleId, employeeId, employeeScheduleId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid schedule, employee or employeeSchedule Id!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById({
      _id: scheduleId,
      employeeSchedules: { $elemMatch: { employeeId: employeeId } },
    })
      .select("_id employeeSchedules")
      .lean();

    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the employee is in the schedule
    const employeeSchedule: IEmployeeSchedule | null =
      schedule.employeesSchedules.find(
        (emp) => emp._id == employeeScheduleId && emp.employeeId == employeeId
      ) || null;

    if (!employeeSchedule) {
      return new NextResponse(
        JSON.stringify({ message: "Employee not found in schedule!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let scheduleToDelete = schedule.employeesSchedules.find(
      (schedule) => schedule._id == employeeScheduleId
    );

    // Delete the employee from the schedule
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $pull: { employeesSchedules: { _id: employeeScheduleId } },
        $inc: {
          totalEmployeesScheduled: -(schedule?.employeesSchedules.length > 0
            ? 0
            : 1),
          totalEmployeesVacation: -(scheduleToDelete?.vacation === true
            ? 1
            : 0),
          totalDayEmployeesCost: -(scheduleToDelete?.employeeCost ?? 0),
        },
      },
      { new: true, lean: true }
    );

    // update employee vacation days left
    if (updatedSchedule && scheduleToDelete?.vacation === true) {
      const updatedEmployee = await Employee.findByIdAndUpdate(
        employeeId,
        { $inc: { vacationDaysLeft: 1 } },
        { new: true, lean: true }
      );

      if (!updatedEmployee) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Update employee vacation days left failed upon employee schedule deletation!",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new NextResponse(
      JSON.stringify({ message: "Employee deleted from schedule!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete employee from schedule failed!", error);
  }
};
