import { NextResponse } from "next/server";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@shared/utils/objDefaultValidation";
import { handleApiError } from "@/lib/db/handleApiError";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";

// imported interfaces
import { IEmployee, ISalary } from "@shared/interfaces/IEmployee";
import { IUser } from "@shared/interfaces/IUser";

// imported models
import Employee from "@/lib/db/models/employee";
import User from "@/lib/db/models/user";

// imported enums
import { userRolesEnums } from "@/lib/enums";

const reqSalaryFields = ["payFrequency", "grossSalary", "netSalary"];

// @desc    Get all employees
// @route   GET /employees
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const employees = await Employee.find().lean();

    return !employees?.length
      ? new NextResponse(JSON.stringify({ message: "No employees found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(employees), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all employees failed!", error as string);
  }
};

// @desc    Create new employee
// @route   POST /employees
// @access  Private
export const POST = async (req: Request) => {
  try {
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
    const businessId = formData.get("businessId") as string;
    const userEmail = formData.get("userEmail") as string; // userEmail is needed to find the user and add userId
    const contractHoursWeek = Number(formData.get("contractHoursWeek")) as
      | number
      | undefined;
    const salary = formData.get("salary")
      ? (JSON.parse(formData.get("salary") as string) as ISalary)
      : undefined;
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
      !businessId ||
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

    // validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Business ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // max file quantity is 10
    if (files && files.length > 10) {
      return new NextResponse(
        JSON.stringify({ message: "Max file quantity is 3!" }),
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

    // connect before first call to DB
    await connectDb();

    // Start a session to handle transactions
    // with session if any error occurs, the transaction will be aborted
    // session is created outside of the try block to be able to abort it in the catch/finally block
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // check if user exist
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
        businessId: businessId,
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

      const employeeId = new mongoose.Types.ObjectId();

      // Create the employee object
      const newEmployee: IEmployee = {
        _id: employeeId,
        allEmployeeRoles,
        taxNumber,
        joinDate,
        vacationDaysPerYear,
        businessId,
        userId: user._id!,
        vacationDaysLeft: vacationDaysPerYear,
        contractHoursWeek: contractHoursWeek || undefined,
        salary: salary || undefined,
        comments: comments || undefined,
      };

      // upload image
      if (
        files?.every((file) => file instanceof File && file.size > 0) &&
        files.length > 0
      ) {
        const folder = `/business/${businessId}/employees/${employeeId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: files,
          onlyImages: false,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          await session.abortTransaction();
          return new NextResponse(
            JSON.stringify({
              message: `Error uploading files: ${cloudinaryUploadResponse}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        newEmployee.documentsUrl = cloudinaryUploadResponse;
      }

      // create employee and update user with the employeeId
      const [createEmployee, updateUser] = await Promise.all([
        // WHEN USING SESSION TO CREATE, YOU MUST PASS AN ARRAY OF OBJECTS
        Employee.create([newEmployee], { session }),
        User.findOneAndUpdate(
          { _id: user._id },
          { $set: { employeeDetails: employeeId } },
          { new: true, lean: true, session }
        ),
      ]);

      if (!createEmployee || !updateUser) {
        await session.abortTransaction();
        const message = !createEmployee
          ? `Error creating employee!`
          : `Error updating user!`;
        return new NextResponse(
          JSON.stringify({
            message: message,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await session.commitTransaction();

      return new NextResponse(
        JSON.stringify({
          message: `New employee created successfully!`,
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      await session.abortTransaction();
      return handleApiError("Create employee failed!", error as string);
    } finally {
      session.endSession();
    }
  } catch (error) {
    return handleApiError("Create employee failed!", error as string);
  }
};
