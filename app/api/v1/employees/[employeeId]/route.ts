import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import { calculateVacationProportional } from "../utils/calculateVacationProportional";

// imported interfaces
import { IEmployee } from "@/lib/interface/IEmployee";

// imported models
import Employee from "@/lib/db/models/employee";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import Printer from "@/lib/db/models/printer";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";

const reqSalaryFields = ["payFrequency", "grossSalary", "netSalary"];

// @desc    Get employee by ID
// @route   GET /employees/:employeeId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { employeeId: Types.ObjectId } }
) => {
  try {
    const employeeId = context.params.employeeId;

    if (!isObjectIdValid([employeeId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid employee ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const employee = await Employee.findById(employeeId).lean();

    return !employee
      ? new NextResponse(JSON.stringify({ message: "Employee not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(employee), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get employee by its id failed!", error as string);
  }
};

// employee DO NOT UPDATE notifications, only readFlag
// @desc    Update employee
// @route   PATCH /employees/:employeeId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { employeeId: Types.ObjectId } }
) => {
  const employeeId = context.params.employeeId;
  const {
    allEmployeeRoles,
    taxNumber,
    joinDate,
    active,
    onDuty,
    vacationDaysPerYear,
    currentShiftRole,
    contractHoursWeek,
    salary,
    terminatedDate,
    comments,
  } = (await req.json()) as IEmployee;

  // check required fields
  if (
    !allEmployeeRoles ||
    !taxNumber ||
    !joinDate ||
    active === undefined ||
    onDuty === undefined ||
    !vacationDaysPerYear
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "PersonalDetails, allEmployeeRoles, taxNumber, joinDate, active, onDuty and vacationDaysPerYea are required fields!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // validate salary
  if (salary) {
    const salaryValidationResult = objDefaultValidation(
      salary,
      reqSalaryFields,
      []
    );

    if (salaryValidationResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: salaryValidationResult }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // connect before first call to DB
    await connectDb();

    // check if employee exists
    const employee = await Employee.findById(employeeId);

    if (!employee) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Employee not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const updateEmployeeObj: Partial<IEmployee> = {};

    if (allEmployeeRoles) updateEmployeeObj.allEmployeeRoles = allEmployeeRoles;
    if (taxNumber) updateEmployeeObj.taxNumber = taxNumber;
    if (joinDate) updateEmployeeObj.joinDate = joinDate;
    if (vacationDaysPerYear)
      updateEmployeeObj.vacationDaysPerYear = vacationDaysPerYear;
    if (currentShiftRole) updateEmployeeObj.currentShiftRole = currentShiftRole;
    if (contractHoursWeek)
      updateEmployeeObj.contractHoursWeek = contractHoursWeek;
    if (salary) updateEmployeeObj.salary = salary;
    if (terminatedDate) updateEmployeeObj.terminatedDate = terminatedDate;
    if (comments) updateEmployeeObj.comments = comments;

    // Calculate vacationDaysLeft if relevant fields are updated
    if (
      vacationDaysPerYear !== employee.vacationDaysPerYear ||
      joinDate !== employee.joinDate
    ) {
      updateEmployeeObj.vacationDaysLeft = calculateVacationProportional(
        new Date(joinDate || employee.joinDate),
        vacationDaysPerYear || employee.vacationDaysPerYear
      );
    }

    const [updatedEmployee, updatePrinter] = await Promise.all([
      // Update the employee
      Employee.findOneAndUpdate(
        { _id: employeeId },
        { $set: updateEmployeeObj },
        { new: true, lean: true, session }
      ),

      // If employee is not active, remove them from printers
      active === false
        ? Printer.updateMany(
            {
              businessId: employee.businessId,
              $or: [
                { employeesAllowedToPrintDataIds: employeeId },
                {
                  // <-- Fix here
                  "configurationSetupToPrintOrders.excludeemployeeIds":
                    employeeId,
                },
              ],
            },
            {
              $pull: {
                employeesAllowedToPrintDataIds: employeeId,
                // <-- Fix here
                "configurationSetupToPrintOrders.$[].excludeemployeeIds":
                  employeeId,
              },
            },
            { session }
          )
        : Promise.resolve(null), // If active is true, resolve with null
    ]);

    // Handle the results if needed
    if (!updatedEmployee) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Employee not found or not updated",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (updatePrinter && updatePrinter.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "No printer data was updated",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Employee updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Update employee failed!", error as string);
  } finally {
    session.endSession();
  }
};

// delete an employee shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an employee should be deleted is if the business itself is deleted
// If you delete a employee from the database and there are other documents that have a relationship with that employee, those related documents may still reference the deleted employee. This can lead to issues such as orphaned records, broken references, and potential errors when querying or processing those related documents.
// @desc    Delete employee
// @route   DELETE /employees/:employeeId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { employeeId: Types.ObjectId } }
) => {
  try {
    const employeeId = context.params.employeeId;

    // check if the employeeId is a valid ObjectId
    if (!isObjectIdValid([employeeId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid employee ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Delete the employee
    const result = await Employee.deleteOne({ _id: employeeId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Employee not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Employee id ${employeeId} deleted successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete employee failed!", error as string);
  }
};
