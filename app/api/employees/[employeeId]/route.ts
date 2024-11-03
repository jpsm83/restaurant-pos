import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { personalDetailsValidation } from "../../../lib/utils/personalDetailsValidation";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { calculateVacationProportional } from "../utils/calculateVacationProportional";

// imported interfaces
import { IEmployee } from "@/app/lib/interface/IEmployee";

// imported models
import Employee from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import salaryValidation from "../utils/salaryValidation";
import Printer from "@/app/lib/models/printer";

// @desc    Get employee by ID
// @route   GET /employees/:employeeId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { employeeId: Types.ObjectId } }
) => {
  try {
    const employeeId = context.params.employeeId;

    if (isObjectIdValid([employeeId]) !== true) {
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

    const employee = await Employee.findById(employeeId)
      .select("-password")
      .lean();

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
    return handleApiError("Get employee by its id failed!", error);
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
    employeeName,
    email,
    password,
    idType,
    idNumber,
    allEmployeeRoles,
    personalDetails,
    taxNumber,
    joinDate,
    active,
    onDuty,
    vacationDaysPerYear,
    currentShiftRole,
    address,
    contractHoursWeek, // in milliseconds
    salary,
    terminatedDate,
    comments,
  } = (await req.json()) as IEmployee;

  // validate employeeId
  if (isObjectIdValid([employeeId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Employee ID is not valid!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // prepare update object
  const updateEmployeeObj: Partial<IEmployee> = {};

  // add address fields
  if (address) {
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      return new NextResponse(JSON.stringify({ message: validAddress }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    updateEmployeeObj.address = address;
  }

  // check personalDetails validation
  if (personalDetails) {
    const checkPersonalDetailsValidation =
      personalDetailsValidation(personalDetails);
    if (checkPersonalDetailsValidation !== true) {
      return new NextResponse(
        JSON.stringify({ message: checkPersonalDetailsValidation }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    updateEmployeeObj.personalDetails = personalDetails;
  }

  if (salary) {
    const salaryValidationResult = salaryValidation(salary);
    if (salaryValidationResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: salaryValidationResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    updateEmployeeObj.salary = salary;
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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

    // check for duplicates employeeName, email, taxNumber and idNumber with same business ID
    const duplicateEmployee: IEmployee | null = await Employee.findOne({
      _id: { $ne: employeeId },
      businessId: employee.businessId,
      $or: [{ employeeName }, { email }, { taxNumber }, { idNumber }],
    }).lean();

    if (duplicateEmployee) {
      await session.abortTransaction();
      const message = duplicateEmployee.active
        ? "EmployeeName, email, taxNumber, or idNumber already exists and employee is active!"
        : "EmployeeName, email, taxNumber, or idNumber already exists in an inactive employee!";

      return new NextResponse(JSON.stringify({ message }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Hash password asynchronously only if it is provided
    if (password) {
      updateEmployeeObj.password = await hash(password, 10);
    }

    // Calculate vacationDaysLeft if relevant fields are updated
    if (vacationDaysPerYear || joinDate) {
      updateEmployeeObj.vacationDaysLeft = calculateVacationProportional(
        new Date(joinDate || employee.joinDate),
        vacationDaysPerYear || employee.vacationDaysPerYear
      );
    }

    // convert hours to milliseconds
    // employee might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    let contractHoursWeekMls;
    if (contractHoursWeek) {
      contractHoursWeekMls = contractHoursWeek * 3600000;
    }

    // Populate the update object with other provided fields
    if (employeeName) updateEmployeeObj.employeeName = employeeName;
    if (email) updateEmployeeObj.email = email;
    if (idType) updateEmployeeObj.idType = idType;
    if (idNumber) updateEmployeeObj.idNumber = idNumber;
    if (allEmployeeRoles) updateEmployeeObj.allEmployeeRoles = allEmployeeRoles;
    if (taxNumber) updateEmployeeObj.taxNumber = taxNumber;
    if (joinDate) updateEmployeeObj.joinDate = joinDate;
    if (active !== undefined) updateEmployeeObj.active = active;
    if (onDuty !== undefined) updateEmployeeObj.onDuty = onDuty;
    if (vacationDaysPerYear)
      updateEmployeeObj.vacationDaysPerYear = vacationDaysPerYear;
    if (currentShiftRole) updateEmployeeObj.currentShiftRole = currentShiftRole;
    if (contractHoursWeek)
      updateEmployeeObj.contractHoursWeek = contractHoursWeekMls; // in milliseconds
    if (terminatedDate) updateEmployeeObj.terminatedDate = terminatedDate;
    if (comments) updateEmployeeObj.comments = comments;

    const [updatedEmployee, updatePrinter] = await Promise.all([
      // update the employee
      Employee.updateOne(
        { _id: employeeId },
        { $set: updateEmployeeObj },
        {
          session,
        }
      ),

      // after updating employee, if employee id not active, delete printer related data
      active === false
        ? Printer.updateMany(
            {
              businessId: employee.businessId,
              $or: [
                { employeesAllowedToPrintDataIds: employeeId },
                {
                  "configurationSetupToPrintOrders.excludeEmployeeIds":
                    employeeId,
                },
              ],
            },
            {
              $pull: {
                employeesAllowedToPrintDataIds: employeeId,
                "configurationSetupToPrintOrders.excludeEmployeeIds":
                  employeeId,
              },
            },
            { session }
          )
        : Promise.resolve(null), // If active is true, resolve with null
    ]);

    // Handle the results if needed
    if (updatedEmployee.modifiedCount === 0) {
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
        message: `Employee ${updateEmployeeObj.employeeName} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Update employee failed!", error);
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
    return handleApiError("Delete employee failed!", error);
  }
};
