import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import { calculateVacationProportional } from "../utils/calculateVacationProportional";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@shared/utils/objDefaultValidation";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import deleteFolderCloudinary from "@/lib/cloudinary/deleteFolderCloudinary";

// imported interfaces
import { IEmployee, ISalary } from "@shared/interfaces/IEmployee";
import { IUser } from "@shared/interfaces/IUser";

// imported models
import Employee from "@/lib/db/models/employee";
import Printer from "@/lib/db/models/printer";
import User from "@/lib/db/models/user";

// imported enums
import { userRolesEnums } from "@/lib/enums";

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
  try {
    const { employeeId } = context.params;

    // validate businessId
    if (isObjectIdValid([employeeId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Business ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract required fields
    const allEmployeeRoles = JSON.parse(
      formData.get("allEmployeeRoles") as string
    ) as string[];
    const taxNumber = formData.get("taxNumber") as string;
    const joinDate = new Date(formData.get("joinDate") as string);
    const vacationDaysPerYear = parseInt(
      formData.get("vacationDaysPerYear") as string
    );
    const userEmail = formData.get("userEmail") as string; // userEmail is needed to find the user and add userId
    const active = formData.get("active") === "true";
    const contractHoursWeek = Number(formData.get("contractHoursWeek")) as
      | number
      | undefined;
    const salary = formData.get("salary")
      ? (JSON.parse(formData.get("salary") as string) as ISalary)
      : undefined;
    const terminatedDate = new Date(formData.get("terminatedDate") as string);
    const comments = formData.get("comments") as string;

    const files = formData
      .getAll("documentsUrl")
      .filter((entry): entry is File => entry instanceof File); // Get all files

    // check required fields
    if (
      !allEmployeeRoles ||
      !taxNumber ||
      !joinDate ||
      !vacationDaysPerYear ||
      !userEmail // userEmail is needed to find the user and add userId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "AllEmployeeRoles, taxNumber, joinDate, vacationDaysPerYear, businessId and userEmail are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if roles is valid
    allEmployeeRoles.forEach((role) => {
      if (!userRolesEnums.includes(role)) {
        return new NextResponse(
          JSON.stringify({ message: "Invalid subscription!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    });

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
      const employee = (await Employee.findById(employeeId)
        .populate({
          path: "userId",
          select: "personalDetails.email",
          model: User,
        })
        .lean()) as (IEmployee & { userId: IUser }) | null;

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

      // max file quantity is 10
      if (files && files.length + (employee?.documentsUrl?.length || 0) > 10) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Max file quantity is 10!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const updateEmployeeObj: Partial<IEmployee> = {};

      if (allEmployeeRoles && allEmployeeRoles !== employee.allEmployeeRoles)
        updateEmployeeObj.allEmployeeRoles = allEmployeeRoles;
      if (taxNumber && taxNumber !== employee.taxNumber)
        updateEmployeeObj.taxNumber = taxNumber;
      if (joinDate && joinDate !== employee.joinDate)
        updateEmployeeObj.joinDate = joinDate;
      if (
        vacationDaysPerYear &&
        vacationDaysPerYear !== employee.vacationDaysPerYear
      )
        updateEmployeeObj.vacationDaysPerYear = vacationDaysPerYear;
      if (active !== undefined && active !== employee.active)
        updateEmployeeObj.active = active;
      if (contractHoursWeek && contractHoursWeek !== employee.contractHoursWeek)
        updateEmployeeObj.contractHoursWeek = contractHoursWeek;
      if (terminatedDate && terminatedDate !== employee.terminatedDate)
        updateEmployeeObj.terminatedDate = terminatedDate;
      if (comments && comments !== employee.comments)
        updateEmployeeObj.comments = comments;

      // check if salary is updated
      if (salary) {
        // Handle address updates dynamically
        const updatedSalary: Partial<ISalary> = {};
        for (const [key, value] of Object.entries(salary)) {
          if (value !== employee.salary?.[key as keyof typeof salary]) {
            updatedSalary[key as keyof typeof salary] = value;
          }
        }
        if (Object.keys(updatedSalary).length > 0)
          //@ts-ignore
          updateEmployeeObj.salary = updatedSalary;
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

      // check if new user exist
      if (userEmail !== employee?.userId.personalDetails.email) {
        const user = await User.findOne({ "personalDetails.email": userEmail })
          .select("_id")
          .lean<IUser | null>(); // Explicitly type the result as IUser or null

        if (!user) {
          await session.abortTransaction();
          return new NextResponse(
            JSON.stringify({
              message: "User does not exist!",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const employeeAlreadyExists = await Employee.exists({
          businessId: employee.businessId,
          userId: user._id,
        });

        if (employeeAlreadyExists) {
          await session.abortTransaction();
          return new NextResponse(
            JSON.stringify({
              message: "User is already an employee!",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const [updatedOldUser, updateNewUser] = await Promise.all([
          User.findOneAndUpdate(
            { _id: employee.userId._id }, // employee.userId is populated
            { $unset: { employeeDetails: null } },
            { new: true, lean: true, session }
          ),

          User.findOneAndUpdate(
            { _id: user._id },
            { $set: { employeeDetails: employeeId } },
            { new: true, lean: true, session }
          ),
        ]);

        if (!updatedOldUser || !updateNewUser) {
          await session.abortTransaction();
          const message = !updatedOldUser
            ? "Old user not found or not updated"
            : "New user not found or not updated";
          return new NextResponse(
            JSON.stringify({
              message: message,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        updateEmployeeObj.userId = user._id;
      }

      // upload image if it exists
      if (
        files?.every((file) => file instanceof File && file.size > 0) &&
        files.length > 0
      ) {
        const folder = `/business/${employee.businessId}/employees/${employeeId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: files,
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          return new NextResponse(
            JSON.stringify({
              message: `Error uploading image: ${cloudinaryUploadResponse}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        updateEmployeeObj.documentsUrl = [
          ...(employee?.documentsUrl || []),
          ...cloudinaryUploadResponse,
        ];
      }

      const [updatedEmployee] = await Promise.all([
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
                    "configurationSetupToPrintOrders.excludeemployeeIds":
                      employeeId,
                  },
                ],
              },
              {
                $pull: {
                  employeesAllowedToPrintDataIds: employeeId,
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
  } catch (error) {
    return handleApiError("Update employee failed!", error as string);
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
  const { employeeId } = context.params;

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

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await Employee.findById(employeeId).lean<IEmployee>();

    if (!employee) {
      return new NextResponse(
        JSON.stringify({ message: "Employee not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Delete the employee, update printers and user
    const [deletedEmployee, updatePrinter, updateUser] = await Promise.all([
      Employee.findOneAndDelete({ _id: employeeId }, { session }),

      Printer.updateMany(
        {
          businessId: employee.businessId,
          $or: [
            { employeesAllowedToPrintDataIds: employeeId },
            {
              "configurationSetupToPrintOrders.excludeemployeeIds": employeeId,
            },
          ],
        },
        {
          $pull: {
            employeesAllowedToPrintDataIds: employeeId,
            "configurationSetupToPrintOrders.$[].excludeemployeeIds":
              employeeId,
          },
        },
        { session }
      ),

      User.findOneAndUpdate(
        { employeeDetails: employeeId },
        { $unset: { employeeDetails: null } },
        { new: true, lean: true, session }
      ),
    ]);

    if (!deletedEmployee || !updatePrinter || !updateUser) {
      await session.abortTransaction();
      const message = !deletedEmployee
        ? "Employee not found or not deleted"
        : !updatePrinter
        ? "Printer not updated"
        : "User not found or not updated";
      return new NextResponse(
        JSON.stringify({
          message: message,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // cloudinary folder path
    const folderPath = `/business/${employee.businessId}/employees/${employeeId}`;

    // Delete business folder in cloudinary
    const deleteFolderCloudinaryResult: string | boolean =
      await deleteFolderCloudinary(folderPath);

    if (deleteFolderCloudinaryResult !== true) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: deleteFolderCloudinaryResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Employee deleted successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete employee failed!", error as string);
  } finally {
    session.endSession();
  }
};
