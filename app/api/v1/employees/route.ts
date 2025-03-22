import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";
import { handleApiError } from "@/lib/db/handleApiError";

// imported interfaces
import { IEmployee } from "@/lib/interface/IEmployee";
import { IUser } from "@/lib/interface/IUser";

// imported models
import Employee from "@/lib/db/models/employee";
import User from "@/lib/db/models/user";

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
    const {
      allEmployeeRoles,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear,
      businessId,
      contractHoursWeek, // in milliseconds
      salary,
      comments,
      userEmail, // user email is used to check the user existence
    } = (await req.json()) as IEmployee & { userEmail: string };

    // check required fields
    if (
      !allEmployeeRoles ||
      !taxNumber ||
      !joinDate ||
      active === undefined ||
      onDuty === undefined ||
      !vacationDaysPerYear ||
      !businessId ||
      !userEmail
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PersonalDetails, allEmployeeRoles, taxNumber, joinDate, active, onDuty, vacationDaysPerYear, businessId and userEmail are required fields!",
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

    // check if user exist
    const user = await User.findOne({ "personalDetails.email": userEmail })
    .select("_id")
    .lean<IUser | null>(); // Explicitly type the result as IUser or null

    if (!user) {
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
    
      const employeeAlreadyExists = await Employee.exists({ businessId: businessId, userId: user._id });

      if(employeeAlreadyExists){
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

    // Create the employee object
    const newEmployee = {
      allEmployeeRoles,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear: vacationDaysPerYear,
      vacationDaysLeft: vacationDaysPerYear,
      businessId,
      userId: user._id,
      contractHoursWeek: contractHoursWeek || undefined,
      salary: salary || undefined,
      comments: comments || undefined,
    };

    // create employee
    await Employee.create(newEmployee);

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
    return handleApiError("Create employee failed!", error as string);
  }
};
