import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported models
import Business from "@/app/lib/models/business";
import { IBusiness } from "@/app/lib/interface/IBusiness";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { addressValidation } from "@/app/lib/utils/addressValidation";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

// @desc    Get all businesses
// @route   GET /business
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const business = await Business.find().select("-password").lean();

    return !business.length
      ? new NextResponse(JSON.stringify({ message: "No business found!" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(business), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all business failed!", error);
  }
};

// @desc    Create new business
// @route   POST /business
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      tradeName,
      legalName,
      email,
      password,
      phoneNumber,
      taxNumber,
      currencyTrade,
      subscription,
      address,
      contactPerson,
      businessTables,
    } = (await req.json()) as IBusiness;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !password ||
      !phoneNumber ||
      !taxNumber ||
      !currencyTrade ||
      !subscription ||
      !address
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Missing required fields!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check email format
    if (!emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // add address fields
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      return new NextResponse(validAddress, {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.findOne({
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateBusiness) {
      return new NextResponse(
        JSON.stringify({
          message: `Business ${legalName}, ${email} or ${taxNumber} already exists!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // hash password
    const hashedPassword = await hash(password, 10);

    // create business object with required fields
    const newBusiness = {
      tradeName,
      legalName,
      email,
      password: hashedPassword,
      phoneNumber,
      taxNumber,
      currencyTrade,
      subscription,
      address,
      contactPerson: contactPerson || undefined,
      businessTables: businessTables || undefined,
    };

    // Create new business
    await Business.create(newBusiness);

    return new NextResponse(
      JSON.stringify({ message: `Business ${legalName} created` }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create business failed!", error);
  }
};
