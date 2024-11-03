import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose, { Types } from "mongoose";
import { v2 as cloudinary } from "cloudinary";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import interfaces
import { IBusiness } from "@/app/lib/interface/IBusiness";

// imported models
import Business from "@/app/lib/models/business";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Notification from "@/app/lib/models/notification";
import Order from "@/app/lib/models/order";
import Printer from "@/app/lib/models/printer";
import Promotion from "@/app/lib/models/promotion";
import Schedule from "@/app/lib/models/schedule";
import Supplier from "@/app/lib/models/supplier";
import SalesInstance from "@/app/lib/models/salesInstance";
import Employee from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import Inventory from "@/app/lib/models/inventory";
import Purchase from "@/app/lib/models/purchase";
import validateBusinessMetrics from "../utils/validateBusinessMetrics";
import SalesPoint from "@/app/lib/models/salesPoint";
import MonthlyBusinessReport from "@/app/lib/models/monthlyBusinessReport";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

// @desc    Get business by businessId
// @route   GET /business/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const business = await Business.findById(businessId)
      .select("-password")
      .lean();

    return !business
      ? new NextResponse(JSON.stringify({ message: "No business found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(business), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get business by its id failed!", error);
  }
};

// @desc    Update business
// @route   PATH /business/:businessId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;
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
      metrics,
      contactPerson,
    } = (await req.json()) as IBusiness;

    // validate businessId
    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check email format
    if (email && !emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate the metrics
    if (metrics) {
      const validateBusinessMetricsResult = validateBusinessMetrics(metrics);
      if (validateBusinessMetricsResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: validateBusinessMetricsResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.findOne({
      _id: { $ne: businessId },
      $or: [{ legalName }, { email }, { taxNumber }],
    }).lean();

    if (duplicateBusiness) {
      return new NextResponse(
        JSON.stringify({
          message: `Business legalname, email or taxNumber already exists!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare updated fields only if they exist (partial update)
    const updateBusinessObj: Partial<IBusiness> = {};

    if (tradeName) updateBusinessObj.tradeName = tradeName;
    if (legalName) updateBusinessObj.legalName = legalName;
    if (email) updateBusinessObj.email = email;
    if (phoneNumber) updateBusinessObj.phoneNumber = phoneNumber;
    if (taxNumber) updateBusinessObj.taxNumber = taxNumber;
    if (currencyTrade) updateBusinessObj.currencyTrade = currencyTrade;
    if (subscription) updateBusinessObj.subscription = subscription;
    if (contactPerson) updateBusinessObj.contactPerson = contactPerson;
    if (metrics) updateBusinessObj.metrics = metrics;

    // Password hash only if password is provided
    if (password) {
      updateBusinessObj.password = await hash(password, 10);
    }

    // Handle address updates with validation
    if (address) {
      // validate the updated address
      const validAddress = addressValidation(address);

      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      updateBusinessObj.address = address;
    }

    // Perform update using $set to modify only specified fields
    const updatedBusiness = await Business.findByIdAndUpdate(
      businessId,
      { $set: updateBusinessObj },
      { new: true, lean: true }
    );

    // If business not found after update
    if (!updatedBusiness) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Business updated successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update business failed!", error);
  }
};

// @desc    Delete business
// @route   DELETE /business/:businessId
// @access  Private
export const DELETE = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  // Cloudinary ENV variables
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const businessId = context.params.businessId;

  // validate businessId
  if (isObjectIdValid([businessId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid businessId!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // delete business and check if it exists
    const result = await Business.deleteOne({ _id: businessId }, { session });

    if (result.deletedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Business not found or atomic deletation failed!",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Delete related data in parallel and the Cloudinary folder
    await Promise.all([
      BusinessGood.deleteMany({ businessId: businessId }, { session }),
      DailySalesReport.deleteMany({ businessId: businessId }, { session }),
      Inventory.deleteMany({ businessId: businessId }, { session }),
      MonthlyBusinessReport.deleteMany({ businessId: businessId }, { session }),
      Notification.deleteMany({ businessId: businessId }, { session }),
      Order.deleteMany({ businessId: businessId }, { session }),
      Printer.deleteMany({ businessId: businessId }, { session }),
      Promotion.deleteMany({ businessId: businessId }, { session }),
      Purchase.deleteMany({ businessId: businessId }, { session }),
      SalesInstance.deleteMany({ businessId: businessId }, { session }),
      SalesPoint.deleteMany({ businessId: businessId }, { session }),
      Schedule.deleteMany({ businessId: businessId }, { session }),
      SupplierGood.deleteMany({ businessId: businessId }, { session }),
      Supplier.deleteMany({ businessId: businessId }, { session }),
      Employee.deleteMany({ businessId: businessId }, { session }),
    ]);

    const cloudinaryFolder = await cloudinary.api.sub_folders(
      "restaurant-pos/"
    );

    let subfoldersArr: string[] = [];

    cloudinaryFolder.folders.forEach((folder: any) =>
      subfoldersArr.push(folder.name)
    );

    if (subfoldersArr.includes(businessId.toString())) {
      try {
        await cloudinary.api.delete_folder(`restaurant-pos/${businessId}/`);
      } catch (error) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Cloudinary folder deletion failed!" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // commit the transaction
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Business deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete business failed!", error);
  } finally {
    session.endSession();
  }
};
