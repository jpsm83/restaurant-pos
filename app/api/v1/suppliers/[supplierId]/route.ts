import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";
import deleteSingleImage from "@/lib/cloudinary/deleteSingleImage";
import uploadSingleImage from "@/lib/cloudinary/uploadSingleImage";

// imported interface
import { ISupplier } from "@/lib/interface/ISupplier";

// imported models
import Supplier from "@/lib/db/models/supplier";
import SupplierGood from "@/lib/db/models/supplierGood";
import BusinessGood from "@/lib/db/models/businessGood";

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
    const currentlyInUse = formData.get("currentlyInUse") === "true"; // Convert string to boolean
    const address = formData.get("address")
      ? JSON.parse(formData.get("address") as string)
      : undefined;
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const imageFile = formData.get("imageUrl") as File | undefined; // Get image file

    // prepare update object

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

    // Prepare fields for update if they are provided
    // WE DONT NEED TO COMPARE IF THE VALUE IS THE SAME AS THE CURRENT ONE
    // UPDATEONE WILL ONLY UPDATE THE FIELDS THAT ARE DIFFERENT
    const supplierObj: ISupplier = {
      tradeName: tradeName,
      legalName: legalName,
      phoneNumber: phoneNumber,
      taxNumber: taxNumber,
      currentlyInUse: currentlyInUse,
      businessId: supplier.businessId,
      email: email || undefined,
      contactPerson: contactPerson || undefined,
      imageUrl: supplier.imageUrl || undefined,
      address: {
        country: address.country,
        state: address.state,
        city: address.city,
        street: address.street,
        buildingNumber: address.buildingNumber,
        postCode: address.postCode,
        region: address.region || undefined,
        additionalDetails: address.additionalDetails || undefined,
        coordinates: address.coordinates || undefined,
      },
    };

    if (imageFile) {
      // first delete the existing image if it exists
      const deleteSingleImageResult: string | boolean = await deleteSingleImage(
        supplier?.imageUrl || ""
      );

      // check if deleteSingleImage failed
      if (deleteSingleImageResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: deleteSingleImageResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const folder = `/business/${supplier?.businessId}/suppliers/${supplierId}`;

      // upload new image
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

      supplierObj.imageUrl = cloudinaryUploadResponse;
    }

    // Save the updated supplier
    // UPDATEONE WILL ONLY UPDATE THE FIELDS THAT ARE DIFFERENT
    await Supplier.updateOne({ _id: supplierId }, supplierObj);

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
    const supplierId = context.params.supplierId;

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

    const supplier = (await Supplier.findById(supplierId)
      .select("imageUrl")
      .lean()) as { imageUrl?: string } | null;

    const deleteSingleImageResult: string | boolean = await deleteSingleImage(
      supplier?.imageUrl || ""
    );

    // check if deleteSingleImage failed
    if (deleteSingleImageResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: deleteSingleImageResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the supplier
    const result = await Supplier.deleteOne({ _id: supplierId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
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
