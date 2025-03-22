import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Supplier from "@/app/lib/models/supplier";
import mongoose from "mongoose";
import uploadSingleImage from "@/app/lib/cloudinary/uploadSingleImage";

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
    // Parse form data instead of JSON
    const formData = await req.formData();

    // Extract fields from formData
    const tradeName = formData.get("tradeName") as string;
    const legalName = formData.get("legalName") as string;
    const email = formData.get("email") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const taxNumber = formData.get("taxNumber") as string;
    const currentlyInUse = formData.get("currentlyInUse") === "true"; // Convert string to boolean
    const businessId = formData.get("businessId") as string;
    const address = formData.get("address")
      ? JSON.parse(formData.get("address") as string)
      : undefined;
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const imageFile = formData.get("imageUrl") as File | null; // Get image file

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !phoneNumber ||
      !taxNumber ||
      currentlyInUse === undefined ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse and businessId are required!",
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

    // validate address fields
    if (address) {
      const validAddress = addressValidation(address);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // validate the reserve string "One Time Purchase" for tradeName, legalName, phoneNumber and taxNumber
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

    let imageUrl: string | undefined;

    if (imageFile) {
      const folder = `/business/${businessId}/suppliers/${supplierId}`;

      const cloudinaryUploadResponse = await uploadSingleImage({
        folder,
        imageFile,
      });

      if (
        !cloudinaryUploadResponse ||
        !cloudinaryUploadResponse.includes("https://")
      ) {
        return new NextResponse(
          JSON.stringify({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      imageUrl = cloudinaryUploadResponse;
    }

    // create supplier object with required fields
    const newSupplier = {
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
      imageUrl: imageUrl || undefined,
    };

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
