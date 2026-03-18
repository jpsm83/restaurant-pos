import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@shared/utils/objDefaultValidation";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import deleteFilesCloudinary from "@/lib/cloudinary/deleteFilesCloudinary";
import deleteFolderCloudinary from "@/lib/cloudinary/deleteFolderCloudinary";

// imported interface
import { ISupplier } from "@shared/interfaces/ISupplier";
import { IAddress } from "@shared/interfaces/IAddress";

// imported models
import Supplier from "@/lib/db/models/supplier";
import SupplierGood from "@/lib/db/models/supplierGood";
import BusinessGood from "@/lib/db/models/businessGood";

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

// @desc    Get supplier by ID
// @route   GET /supplier/:supplierId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const supplierId = context.params.supplierId;

    if (isObjectIdValid([supplierId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplier ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const supplier = await Supplier.findById(supplierId).lean();

    return !supplier
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(supplier), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get supplier by its id failed!", error as string);
  }
};

// @desc    Update supplier
// @route   PATCH /supplier/:supplierId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const { supplierId } = context.params;

    if (isObjectIdValid([supplierId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplier ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract fields from formData
    const tradeName = formData.get("tradeName") as string;
    const legalName = formData.get("legalName") as string;
    const email = formData.get("email") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const taxNumber = formData.get("taxNumber") as string;
    const address = JSON.parse(formData.get("address") as string);
    const currentlyInUse = formData.get("currentlyInUse") === "true"; // Convert string to boolean
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const imageUrl = formData.get("imageUrl") as File | undefined;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !phoneNumber ||
      !taxNumber ||
      currentlyInUse === undefined ||
      !address
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse, address and businessId are required!",
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

    // connect before first call to DB
    await connectDb();

    // check if supplier exists
    const supplier = (await Supplier.findById(supplierId)
      .select("businessId imageUrl address")
      .lean()) as unknown as ISupplier | null;

    if (!supplier) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check for duplicate legalName, email or taxNumber
    const duplicateSupplier = await Supplier.exists({
      _id: { $ne: supplierId },
      businessId: supplier.businessId,
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateSupplier) {
      return new NextResponse(
        JSON.stringify({
          message: `Supplier legalName, email or taxNumber already exists in the business!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare updated fields only if they exist (partial update)
    const updateSupplierObj: Partial<ISupplier> = {};

    if (tradeName && supplier.tradeName !== tradeName)
      updateSupplierObj.tradeName = tradeName;
    if (legalName && supplier.legalName !== legalName)
      updateSupplierObj.legalName = legalName;
    if (email && supplier.email !== email) updateSupplierObj.email = email;
    if (phoneNumber && supplier.phoneNumber !== phoneNumber)
      updateSupplierObj.phoneNumber = phoneNumber;
    if (taxNumber && supplier.taxNumber !== taxNumber)
      updateSupplierObj.taxNumber = taxNumber;
    if (currentlyInUse && supplier.currentlyInUse !== currentlyInUse)
      updateSupplierObj.currentlyInUse = currentlyInUse;
    if (contactPerson && supplier.contactPerson !== contactPerson)
      updateSupplierObj.contactPerson = contactPerson;

    // Handle address updates dynamically
    const updatedAddress: Partial<IAddress> = {};
    
    for (const [key, value] of Object.entries(address)) {
      if (value !== supplier.address?.[key as keyof typeof address]) {
        updatedAddress[key as keyof typeof address] = value;
      }
    }
    if (Object.keys(updatedAddress).length > 0)
      //@ts-ignore
      updateSupplierObj.address = updatedAddress;

    if (imageUrl && imageUrl instanceof File && imageUrl.size > 0) {
      const folder = `/business/${supplier.businessId}/suppliers/${supplierId}`;

      // first upload new image
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

      // if new image been created, them delete the old one
      const deleteFilesCloudinaryResult: string | boolean =
        await deleteFilesCloudinary(supplier?.imageUrl || "");

      // check if deleteFilesCloudinary failed
      if (deleteFilesCloudinaryResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: deleteFilesCloudinaryResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      updateSupplierObj.imageUrl = cloudinaryUploadResponse[0];
    }

    // Perform update using $set to modify only specified fields
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      supplierId,
      { $set: updateSupplierObj },
      { new: true, lean: true }
    );

    // If business not found after update
    if (!updatedSupplier) {
      return new NextResponse(
        JSON.stringify({ message: "Business to update not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Supplier updated successfully!",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update supplier failed!", error as string);
  }
};

// delete a supplier shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier should be deleted is if the business itself is deleted
// but in case you want to delete a supplier you can use the following code
// be aware that this will remove the supplier from the database and all the supplier goods reference will be lost
// @desc    Delete supplier
// @route   DELETE /supplier/:supplierId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const { supplierId } = context.params;

    // validate supplierId
    if (!isObjectIdValid([supplierId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplier ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // **********************************************************************
    // do not allow to delete a supplier that is in use in any business goods
    // **********************************************************************

    // Check if any supplier goods referencing this supplier are in use at any business goods
    const supplierGoodIds = await SupplierGood.find({
      supplierId: supplierId,
    }).distinct("_id");

    if (supplierGoodIds.length > 0) {
      const isInUse = await BusinessGood.exists({
        "ingredients.supplierGoodId": { $in: supplierGoodIds },
      });

      if (isInUse) {
        return new NextResponse(
          JSON.stringify({
            message: "Supplier is in use in some business goods!",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // delete the supplier
    // findOneAndDelete returns the deleted document
    const deletedSupplier = await Supplier.findOneAndDelete({
      _id: supplierId,
    });

    if (!deletedSupplier) {
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // cloudinary folder path
    const folderPath = `/business/${deletedSupplier?.businessId}/suppliers/${supplierId}`;

    // Delete business folder in cloudinary
    const deleteFolderCloudinaryResult: string | boolean =
      await deleteFolderCloudinary(folderPath);

    if (deleteFolderCloudinaryResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: deleteFolderCloudinaryResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Supplier deleted successfully!`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete supplier failed!", error as string);
  }
};
