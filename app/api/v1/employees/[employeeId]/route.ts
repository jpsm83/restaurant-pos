import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { calculateVacationProportional } from "../utils/calculateVacationProportional";

// imported interfaces
import { IEmployee } from "@/app/lib/interface/IEmployee";

// imported models
import Employee from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import Printer from "@/app/lib/models/printer";
import objDefaultValidation from "@/app/lib/utils/objDefaultValidation";

const reqPersonalDetailsFields = [
  "username",
  "email",
  "password",
  "idType",
  "idNumber",
  "firstName",
  "lastName",
  "address",
];

const nonReqPersonalDetailsFields = [
  "imageUrl",
  "nationality",
  "gender",
  "birthDate",
  "phoneNumber",
  "deviceToken",
  "notifications",
];

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

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

    const employee = await Employee.findById(employeeId, {
      "personalDetails.password": 0,
    }).lean();

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
    personalDetails,
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
    !personalDetails ||
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

  // validate personalDetails
  const personalDetailsValidationResult = objDefaultValidation(
    personalDetails,
    reqPersonalDetailsFields,
    nonReqPersonalDetailsFields
  );

  if (personalDetailsValidationResult !== true) {
    return new NextResponse(
      JSON.stringify({ message: personalDetailsValidationResult }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validate address
  const addressValidationResult = objDefaultValidation(
    personalDetails.address,
    reqAddressFields,
    nonReqAddressFields
  );

  if (addressValidationResult !== true) {
    return new NextResponse(
      JSON.stringify({ message: addressValidationResult }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
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

    // check for duplicates employeeName, email, taxNumber and idNumber with same business ID
    const duplicateEmployee = (await Employee.findOne({
      _id: { $ne: employeeId },
      businessId: employee.businessId,
      $or: [
        { "personalDetails.username": personalDetails.username },
        { "personalDetails.email": personalDetails.email },
        { "personalDetails.idNumber": personalDetails.idNumber },
      ],
    }).lean()) as unknown as IEmployee | null;

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

    // Iterate through all keys in personalDetails
    Object.keys(personalDetails).forEach((key) => {
      // Check if the key exists in employee.personalDetails and if the value has changed
      if (
        personalDetails[key] !== employee.personalDetails[key] &&
        key !== "address" &&
        key !== "contractHoursWeek"
      ) {
        updateEmployeeObj[`personalDetails.${key}`] = personalDetails[key];
      }

      // Handle nested "address" object
      if (key === "address" && personalDetails.address) {
        Object.keys(personalDetails.address).forEach((addressKey) => {
          // Check if the address field has changed or is new
          if (
            personalDetails.address[addressKey] !==
            employee.personalDetails.address[addressKey]
          ) {
            updateEmployeeObj[`personalDetails.address.${addressKey}`] =
              personalDetails.address[addressKey];
          }
        });
      }
    });

    // If password is updated, hash it and add to the update object
    if (personalDetails.password) {
      updateEmployeeObj["personalDetails.password"] = await hash(
        personalDetails.password,
        10
      );
    }

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
      // update the employee
      Employee.findOneAndUpdate(
        { _id: employeeId },
        { $set: updateEmployeeObj },
        { new: true, session }
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
