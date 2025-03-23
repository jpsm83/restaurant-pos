import { NextResponse } from "next/server";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";

// imported models
import Supplier from "@/lib/db/models/supplier";

// imported interface
import { ISupplier } from "@/lib/interface/ISupplier";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

// @desc    Get all suppliers
// @route   GET /supplier
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const suppliers = await Supplier.find().lean();

    return !suppliers.length
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(suppliers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all suppliers failed!", error as string);
  }
};

// @desc    Create new supplier
// @route   POST /supplier
// @access  Private
// create a new supplier without supplier goods
// supplier goods can be added later on update
export const POST = async (req: Request) => {
  try {
    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract fields from formData
    const tradeName = formData.get("tradeName") as string;
    const legalName = formData.get("legalName") as string;
    const email = formData.get("email") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const taxNumber = formData.get("taxNumber") as string;
    const businessId = formData.get("businessId") as string;
    const address = JSON.parse(formData.get("address") as string);
    const currentlyInUse = formData.get("currentlyInUse") === "true"; // Convert string to boolean
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const files = formData
      .getAll("imageUrl")
      .filter((entry): entry is File => entry instanceof File); // Get all files

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !phoneNumber ||
      !taxNumber ||
      currentlyInUse === undefined ||
      !address ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse, address and businessId are required!",
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

    // check email format
    if (!emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format!" }),
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

    // validate the RESERVE STRING "One Time Purchase" for tradeName, legalName, phoneNumber and taxNumber
    // THIS IS A DEFAULT STRING FOR ONE TIME PURCHASES - EMERGENCY PURCHASES FROM NON-REGISTERED SUPPLIERS
    if (
      tradeName === "One Time Purchase" ||
      legalName === "One Time Purchase" ||
      phoneNumber === "One Time Purchase" ||
      taxNumber === "One Time Purchase"
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, phoneNumber and taxNumber cannot be 'One Time Purchase', thas a reserve string!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate legalName, email or taxNumber
    const duplicateSupplier = await Supplier.exists({
      businessId: businessId,
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateSupplier) {
      return new NextResponse(
        JSON.stringify({
          message: `Supplier ${legalName}, ${email} or ${taxNumber} already exists!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const supplierId = new mongoose.Types.ObjectId();

    // create supplier object with required fields
    const newSupplier: ISupplier = {
      _id: supplierId, // Assign the generated ID
      tradeName,
      legalName,
      email,
      phoneNumber,
      taxNumber,
      currentlyInUse,
      businessId,
      address,
      contactPerson: contactPerson || undefined,
    };

    if (files && files.length > 0) {
      const folder = `/business/${businessId}/suppliers/${supplierId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: [files[0]], // only one image
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

      newSupplier.imageUrl = cloudinaryUploadResponse[0];
    }

    // create new supplier
    await Supplier.create(newSupplier);

    // confirm supplier was created
    return new NextResponse(
      JSON.stringify({
        message: `Supplier ${legalName} created successfully!`,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create supplier failed!", error as string);
  }
};
