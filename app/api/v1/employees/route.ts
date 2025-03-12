import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { IEmployee } from "@/app/lib/interface/IEmployee";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Employee from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import Business from "@/app/lib/models/business";
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

// @desc    Get all employees
// @route   GET /employees
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const employees = await Employee.find(
      {},
      { "personalDetails.password": 0 }
    ).lean();

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
      personalDetails,
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
    } = (await req.json()) as IEmployee;

    // check required fields
    if (
      !personalDetails ||
      !allEmployeeRoles ||
      !taxNumber ||
      !joinDate ||
      active === undefined ||
      onDuty === undefined ||
      !vacationDaysPerYear ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PersonalDetails, allEmployeeRoles, taxNumber, joinDate, active, onDuty, vacationDaysPerYear and businessId are required fields!",
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

    // connect before first call to DB
    await connectDb();

    const [duplicateEmployee, businessExists] = await Promise.all([
      // check for duplicates employeeName, email, taxNumber and idNumber with same businessId ID
      Employee.exists({
        businessId,
        $or: [
          { "personalDetails.username": personalDetails.username },
          { "personalDetails.email": personalDetails.email },
          { "personalDetails.idNumber": personalDetails.idNumber },
          { taxNumber: taxNumber },
        ],
      }),

      // check if business exists
      Business.exists({ _id: businessId }),
    ]);

    if (duplicateEmployee || !businessExists) {
      const message = duplicateEmployee
        ? "Employee with username, email, taxnumber or idNumber already exists!"
        : "Business does not exists!";
      return new NextResponse(
        JSON.stringify({
          message: message,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Hash password asynchronously
    const hashedPassword = await hash(personalDetails.password, 10);

    const personalDetailsObj = {
        ...personalDetails,
        password: hashedPassword,
    };

    // Create the employee object
    const newEmployee = {
      personalDetails: personalDetailsObj,
      allEmployeeRoles,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear: vacationDaysPerYear,
      vacationDaysLeft: vacationDaysPerYear,
      businessId,
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
