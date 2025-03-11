import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import objDefaultValidation from "@/app/lib/utils/objDefaultValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import { IPersonalDetails } from "@/app/lib/interface/IPersonalDetails";

// imported models
import Customer from "@/app/lib/models/customer";

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

// @desc    Get all customers
// @route   GET /customers
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const customers = await Customer.find(
      {},
      { "personalDetails.password": 0 }
    ).lean();

    return !customers?.length
      ? new NextResponse(JSON.stringify({ message: "No customers found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(customers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all customers failed!", error as string);
  }
};

// @desc    Create new customer
// @route   POST /customers
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      personalDetails,
    }: {
      personalDetails: IPersonalDetails;
    } = await req.json();

    // check required fields
    if (!personalDetails) {
      return new NextResponse(
        JSON.stringify({
          message: "PersonalDetails is required fields!",
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

    // connect before first call to DB
    await connectDb();

    // check for duplicates username, email, taxNumber and idNumber
    const duplicateCustomer = await Customer.exists({
      $or: [
        { "personalDetails.username": personalDetails.username },
        { "personalDetails.email": personalDetails.email },
        { "personalDetails.idNumber": personalDetails.idNumber },
      ],
    });

    if (duplicateCustomer) {
      return new NextResponse(
        JSON.stringify({
          message: "Customer with username, email or idNumber already exists!",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Hash password asynchronously
    const hashedPassword = await hash(personalDetails.password, 10);

    const newCustomer = {
      personalDetails: {
        ...personalDetails,
        password: hashedPassword,
      },
    };

    await Customer.create(newCustomer);

    return new NextResponse(
      JSON.stringify({
        message: `New customer created successfully`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create customer failed!", error as string);
  }
};
