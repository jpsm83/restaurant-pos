import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";

// imported interface
import { IBusiness } from "@/lib/interface/IBusiness";

// imported models
import Business from "@/lib/db/models/business";

// imported enums
import { subscriptionEnums, currenctyEnums } from "@/lib/enums";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

// @desc    Get all businesses
// @route   GET /business
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    // get all businesses
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
    return handleApiError("Get all business failed!", error as string);
  }
};

// @desc    Create new business
// @route   POST /business
// @access  Private
export const POST = async (req: Request) => {
  // metrics is created upon updating the business
  // imageUrl are create or delete using cloudinaryActions routes
  try {
    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract fields from formData
    const tradeName = formData.get("tradeName") as string;
    const legalName = formData.get("legalName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const taxNumber = formData.get("taxNumber") as string;
    const subscription = formData.get("subscription") as string;
    const address = JSON.parse(formData.get("address") as string);
    const currencyTrade = formData.get("currencyTrade") as string;
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const imageUrl = formData.get("imageUrl") as File | undefined;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !password ||
      !phoneNumber ||
      !taxNumber ||
      !subscription ||
      !address ||
      !currencyTrade
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, password, phoneNumber, taxNumber, subscription, currencyTrade and address are required!",
        }),
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

    // check password format
    if (!passwordRegex.test(password)) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate address
    const addressValidationResult = objDefaultValidation(
      address,
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

    // check if subscription is valid
    if (!subscriptionEnums.includes(subscription)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid subscription!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if currencyTrade is valid
    if (!currenctyEnums.includes(currencyTrade)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid currencyTrade!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.exists({
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

    const businessId = new mongoose.Types.ObjectId();

    // create business object with required fields
    const newBusiness: IBusiness = {
      _id: businessId,
      tradeName: tradeName,
      legalName: legalName,
      email: email,
      password: hashedPassword,
      phoneNumber: phoneNumber,
      taxNumber: taxNumber,
      currencyTrade: currencyTrade,
      subscription: subscription,
      address: address,
      contactPerson: contactPerson || undefined,
    };

    if (imageUrl && imageUrl instanceof File && imageUrl.size > 0) {
      const folder = `/business/${businessId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: [imageUrl], // only one image
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

      newBusiness.imageUrl = cloudinaryUploadResponse[0];
    }

    // Create new business
    await Business.create(newBusiness);

    return new NextResponse(
      JSON.stringify({ message: `Business ${legalName} created` }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create business failed!", error as string);
  }
};
