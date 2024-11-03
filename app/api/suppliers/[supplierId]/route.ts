import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interface
import { ISupplier } from "@/app/lib/interface/ISupplier";

// imported models
import Supplier from "@/app/lib/models/supplier";
import SupplierGood from "@/app/lib/models/supplierGood";
import BusinessGood from "@/app/lib/models/businessGood";

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
    return handleApiError("Get supplier by its id failed!", error);
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

    const {
      tradeName,
      legalName,
      email,
      phoneNumber,
      taxNumber,
      currentlyInUse,
      address,
      contactPerson,
    } = (await req.json()) as ISupplier;

    // prepare update object
    const supplerObj: Partial<ISupplier> = {};

    // add address fields
    if (address) {
      const validAddress = addressValidation(address);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      supplerObj.address = address;
    }

    // connect before first call to DB
    await connectDb();

    // check if supplier exists
    const supplier: ISupplier | null = await Supplier.findById(supplierId)
      .select("businessId")
      .lean();

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

    // populate supplier goods
    if (tradeName) supplerObj.tradeName = tradeName;
    if (legalName) supplerObj.legalName = legalName;
    if (email) supplerObj.email = email;
    if (phoneNumber) supplerObj.phoneNumber = phoneNumber;
    if (taxNumber) supplerObj.taxNumber = taxNumber;
    if (currentlyInUse) supplerObj.currentlyInUse = currentlyInUse;
    if (contactPerson) supplerObj.contactPerson = contactPerson;

    // Save the updated supplier
    await Supplier.updateOne({ _id: supplierId }, supplerObj);

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
    return handleApiError("Update supplier failed!", error);
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
      "ingredients.supplierGood": { $in: supplierGoodIds },
    });

    if (isInUse) {
      return new NextResponse(
        JSON.stringify({
          message: "Supplier is in use in some business goods!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
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
    return handleApiError("Delete supplier failed!", error);
  }
};
