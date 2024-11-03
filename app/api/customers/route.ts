import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { ICustomer } from "@/app/lib/interface/ICustomer";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Customer from "@/app/lib/models/customer";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { personalDetailsValidation } from "@/app/lib/utils/personalDetailsValidation";
import Business from "@/app/lib/models/business";

// @desc    Get all customers
// @route   GET /customers
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const customers = await Customer.find().select("-password").lean();

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
    return handleApiError("Get all customers failed!", error);
  }
};

// @desc    Create new customer
// @route   POST /customers
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      customerName,
      email,
      password,
      idType,
      idNumber,
      personalDetails,
      businessId,
      address,
    } = (await req.json()) as ICustomer;

    // check required fields
    if (
      !customerName ||
      !email ||
      !password ||
      !idType ||
      !idNumber ||
      !personalDetails ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "CustomerName, email, password, personalDetails and businessId are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessId
    if (!isObjectIdValid([businessId])) {
      return new NextResponse(
        JSON.stringify({ message: "Business ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check address validation
    if (address) {
      const validAddress = addressValidation(address);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // check personalDetails validation
    const checkPersonalDetailsValidation =
      personalDetailsValidation(personalDetails);
    if (checkPersonalDetailsValidation !== true) {
      return new NextResponse(
        JSON.stringify({ message: checkPersonalDetailsValidation }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const [duplicateCustomer, businessExists] = await Promise.all([
      // check for duplicates customerName, email, taxNumber and idNumber with same businessId ID
      Customer.exists({
        businessId,
        $or: [{ customerName }, { email }, { idNumber }],
      }),

      // check if business exists
      Business.exists({ _id: businessId }),
    ]);

    if (duplicateCustomer || !businessExists) {
      let message = duplicateCustomer
        ? "Customer with customerName, email or idNumber already exists!"
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
    const hashedPassword = await hash(password, 10);

    // Create the customer object
    const newCustomer = {
      customerName,
      email,
      password: hashedPassword,
      idType,
      idNumber,
      personalDetails, // object
      businessId,
      address: address || undefined, // object
    };

    // create customer
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
    return handleApiError("Create customer failed!", error);
  }
};
