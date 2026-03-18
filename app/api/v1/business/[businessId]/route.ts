import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@shared/utils/objDefaultValidation";
import deleteFilesCloudinary from "@/lib/cloudinary/deleteFilesCloudinary";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import deleteFolderCloudinary from "@/lib/cloudinary/deleteFolderCloudinary";

// import interfaces
import {
  IBusiness,
  IMetrics,
  IsupplierGoodWastePercentage,
} from "@shared/interfaces/IBusiness";
import { IAddress } from "@shared/interfaces/IAddress";

// imported models
import Business from "@/lib/db/models/business";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Notification from "@/lib/db/models/notification";
import Order from "@/lib/db/models/order";
import Printer from "@/lib/db/models/printer";
import Promotion from "@/lib/db/models/promotion";
import Schedule from "@/lib/db/models/schedule";
import Supplier from "@/lib/db/models/supplier";
import SalesInstance from "@/lib/db/models/salesInstance";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import SupplierGood from "@/lib/db/models/supplierGood";
import Inventory from "@/lib/db/models/inventory";
import Purchase from "@/lib/db/models/purchase";
import SalesPoint from "@/lib/db/models/salesPoint";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import User from "@/lib/db/models/user";
import Rating from "@/lib/db/models/rating";
import Reservation from "@/lib/db/models/reservation";

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

const reqMetrics = [
  "foodCostPercentage",
  "beverageCostPercentage",
  "laborCostPercentage",
  "fixedCostPercentage",
  "supplierGoodWastePercentage",
];

const reqSupplierGoodWastePercentage = [
  "veryLowBudgetImpact",
  "lowBudgetImpact",
  "mediumBudgetImpact",
  "hightBudgetImpact",
  "veryHightBudgetImpact",
];

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
    const { businessId } = await context.params;

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
    return handleApiError("Get business by its id failed!", error as string);
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
    const { businessId } = context.params;

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

    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract fields from formData
    const tradeName = formData.get("tradeName") as string;
    const legalName = formData.get("legalName") as string;
    const email = formData.get("email") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const taxNumber = formData.get("taxNumber") as string;
    const currencyTrade = formData.get("currencyTrade") as string;
    const subscription = formData.get("subscription") as string;
    const address = JSON.parse(formData.get("address") as string);
    const metrics = formData.get("metrics")
      ? JSON.parse(formData.get("metrics") as string)
      : undefined;
    const password = formData.get("password") as string | undefined;
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const imageUrl = formData.get("imageUrl") as File | undefined;
    const cuisineType = formData.get("cuisineType") as string | undefined;
    const categoriesStr = formData.get("categories") as string | undefined;
    const averageRatingStr = formData.get("averageRating") as string | undefined;
    const ratingCountStr = formData.get("ratingCount") as string | undefined;
    const acceptsDeliveryStr = formData.get("acceptsDelivery") as string | undefined;
    const deliveryRadiusStr = formData.get("deliveryRadius") as string | undefined;
    const minOrderStr = formData.get("minOrder") as string | undefined;
    const businessOpeningHoursStr = formData.get(
      "businessOpeningHours"
    ) as string | undefined;
    const deliveryOpeningWindowsStr = formData.get(
      "deliveryOpeningWindows"
    ) as string | undefined;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !phoneNumber ||
      !taxNumber ||
      !subscription ||
      !address ||
      !currencyTrade
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, subscription, currencyTrade and address are required!",
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

    // check password format if exists
    if (password && !passwordRegex.test(password)) {
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

    // validate metrics if exists
    if (metrics) {
      const metricsValidationResult = objDefaultValidation(
        metrics,
        reqMetrics,
        []
      );

      if (metricsValidationResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: metricsValidationResult }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // validate reqSupplierGoodWastePercentage
      const supplierGoodWastePercentageValidationResult = objDefaultValidation(
        metrics.supplierGoodWastePercentage,
        reqSupplierGoodWastePercentage,
        []
      );

      if (supplierGoodWastePercentageValidationResult !== true) {
        return new NextResponse(
          JSON.stringify({
            message: supplierGoodWastePercentageValidationResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
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

    // validate optional discovery/delivery fields if provided
    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (Number.isNaN(n) || n < 0 || n > 5) {
        return new NextResponse(
          JSON.stringify({ message: "averageRating must be between 0 and 5!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    if (ratingCountStr !== undefined && ratingCountStr !== "") {
      const n = Number(ratingCountStr);
      if (Number.isNaN(n) || n < 0) {
        return new NextResponse(
          JSON.stringify({ message: "ratingCount must be a non-negative number!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    if (categoriesStr !== undefined && categoriesStr !== "") {
      try {
        const parsed = JSON.parse(categoriesStr) as unknown;
        if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
          return new NextResponse(
            JSON.stringify({ message: "categories must be an array of strings!" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ message: "categories must be a valid JSON array of strings!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    if (deliveryRadiusStr !== undefined && deliveryRadiusStr !== "") {
      const n = Number(deliveryRadiusStr);
      if (Number.isNaN(n) || n < 0) {
        return new NextResponse(
          JSON.stringify({ message: "deliveryRadius must be a non-negative number!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    if (minOrderStr !== undefined && minOrderStr !== "") {
      const n = Number(minOrderStr);
      if (Number.isNaN(n) || n < 0) {
        return new NextResponse(
          JSON.stringify({ message: "minOrder must be a non-negative number!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.exists({
      _id: { $ne: businessId },
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateBusiness) {
      return new NextResponse(
        JSON.stringify({
          message: `Business legalname, email or taxNumber already exists!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the business
    const business = (await Business.findById(
      businessId
    ).lean()) as IBusiness | null;

    if (!business) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Prepare updated fields only if they exist (partial update)
    const updateBusinessObj: Partial<IBusiness> = {};

    // required fields
    if (tradeName !== business?.tradeName)
      updateBusinessObj.tradeName = tradeName;
    if (legalName !== business?.legalName)
      updateBusinessObj.legalName = legalName;
    if (email !== business?.email) updateBusinessObj.email = email;
    if (phoneNumber !== business?.phoneNumber)
      updateBusinessObj.phoneNumber = phoneNumber;
    if (taxNumber !== business?.taxNumber)
      updateBusinessObj.taxNumber = taxNumber;
    if (currencyTrade !== business?.currencyTrade)
      updateBusinessObj.currencyTrade = currencyTrade;
    if (subscription !== business?.subscription)
      updateBusinessObj.subscription = subscription;
    if (contactPerson && contactPerson !== business?.contactPerson)
      updateBusinessObj.contactPerson = contactPerson;

    if (cuisineType !== undefined) updateBusinessObj.cuisineType = cuisineType || undefined;
    if (categoriesStr !== undefined) {
      try {
        const parsed = JSON.parse(categoriesStr) as string[];
        if (Array.isArray(parsed))
          updateBusinessObj.categories = parsed.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      } catch {
        // leave unchanged if invalid
      }
    }
    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (!Number.isNaN(n) && n >= 0 && n <= 5) updateBusinessObj.averageRating = n;
    }
    if (ratingCountStr !== undefined && ratingCountStr !== "") {
      const n = Number(ratingCountStr);
      if (!Number.isNaN(n) && n >= 0) updateBusinessObj.ratingCount = n;
    }
    if (acceptsDeliveryStr !== undefined && acceptsDeliveryStr !== "")
      updateBusinessObj.acceptsDelivery = acceptsDeliveryStr === "true";
    if (deliveryRadiusStr !== undefined && deliveryRadiusStr !== "") {
      const n = Number(deliveryRadiusStr);
      if (!Number.isNaN(n) && n >= 0) updateBusinessObj.deliveryRadius = n;
    }
    if (minOrderStr !== undefined && minOrderStr !== "") {
      const n = Number(minOrderStr);
      if (!Number.isNaN(n) && n >= 0) updateBusinessObj.minOrder = n;
    }
    if (businessOpeningHoursStr !== undefined) {
      try {
        const parsed = JSON.parse(businessOpeningHoursStr) as unknown;
        if (Array.isArray(parsed)) {
          updateBusinessObj.businessOpeningHours =
            parsed as IBusiness["businessOpeningHours"];
        } else if (businessOpeningHoursStr === "") {
          updateBusinessObj.businessOpeningHours = undefined;
        }
      } catch {
        // leave unchanged if invalid
      }
    }
    if (deliveryOpeningWindowsStr !== undefined) {
      try {
        const parsed = JSON.parse(deliveryOpeningWindowsStr) as unknown;
        if (Array.isArray(parsed)) {
          updateBusinessObj.deliveryOpeningWindows =
            parsed as IBusiness["deliveryOpeningWindows"];
        } else if (deliveryOpeningWindowsStr === "") {
          updateBusinessObj.deliveryOpeningWindows = undefined;
        }
      } catch {
        // leave unchanged if invalid
      }
    }

    // Handle address updates dynamically
    const updatedAddress: Partial<IAddress> = {};
    for (const [key, value] of Object.entries(address)) {
      if (value !== business.address?.[key as keyof typeof address]) {
        updatedAddress[key as keyof typeof address] = value;
      }
    }
    if (Object.keys(updatedAddress).length > 0)
      //@ts-ignore
      updateBusinessObj.address = updatedAddress;

    if (metrics) {
      const updatedMetrics: Partial<IMetrics> = {};
      const updatedSupplierGoodWastePercentage: Partial<IsupplierGoodWastePercentage> =
        {};
      // Handle metrics updates dynamically
      for (const [key, value] of Object.entries(metrics)) {
        if (key !== "supplierGoodWastePercentage") {
          if (value !== business?.metrics?.[key as keyof typeof metrics]) {
            updatedMetrics[key as keyof typeof metrics] = value;
          }
        } else {
          // Handle metrics.supplierGoodWastePercentage updates dynamically
          for (const [key, value] of Object.entries(
            metrics.supplierGoodWastePercentage
          )) {
            if (
              value !==
              business?.metrics?.supplierGoodWastePercentage?.[
                key as keyof typeof metrics.supplierGoodWastePercentage
              ]
            ) {
              updatedSupplierGoodWastePercentage[
                key as keyof typeof metrics.supplierGoodWastePercentage
              ] = value;
            }
          }
        }
      }
      if (Object.keys(updatedSupplierGoodWastePercentage).length > 0)
        //@ts-ignore
        updatedMetrics.supplierGoodWastePercentage =
          updatedSupplierGoodWastePercentage;
      if (Object.keys(updatedMetrics).length > 0)
        //@ts-ignore
        updateBusinessObj.metrics = updatedMetrics;
    }

    if (imageUrl && imageUrl instanceof File && imageUrl.size > 0) {
      const folder = `/business/${businessId}`;

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
        await deleteFilesCloudinary(business?.imageUrl || "");

      // check if deleteFilesCloudinary failed
      if (deleteFilesCloudinaryResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: deleteFilesCloudinaryResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      updateBusinessObj.imageUrl = cloudinaryUploadResponse[0];
    }

    // Password hash only if password is provided
    if (password) {
      updateBusinessObj.password = await hash(password, 10);
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
        JSON.stringify({ message: "Business to update not found!" }),
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
    return handleApiError("Update business failed!", error as string);
  }
};

// @desc    Delete business
// @route   DELETE /business/:businessId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  const { businessId } = context.params;

  // Validate businessId
  if (!isObjectIdValid([businessId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid businessId!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Connect to DB
  await connectDb();

  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete business and related data in parallel
    await Promise.all([
      Business.deleteOne({ _id: businessId }, { session }),
      BusinessGood.deleteMany({ businessId }, { session }),
      DailySalesReport.deleteMany({ businessId }, { session }),
      Employee.deleteMany({ businessId }, { session }),
      Inventory.deleteMany({ businessId }, { session }),
      MonthlyBusinessReport.deleteMany({ businessId }, { session }),
      Notification.deleteMany({ businessId }, { session }),
      Order.deleteMany({ businessId }, { session }),
      Printer.deleteMany({ businessId }, { session }),
      Promotion.deleteMany({ businessId }, { session }),
      Purchase.deleteMany({ businessId }, { session }),
      Rating.deleteMany({ businessId }, { session }),
      Reservation.deleteMany({ businessId }, { session }),
      SalesInstance.deleteMany({ businessId }, { session }),
      SalesPoint.deleteMany({ businessId }, { session }),
      Schedule.deleteMany({ businessId }, { session }),
      SupplierGood.deleteMany({ businessId }, { session }),
      Supplier.deleteMany({ businessId }, { session }),
      User.deleteMany({ businessId }, { session }),
    ]);

    // Commit the database transaction FIRST
    await session.commitTransaction();

    // cloudinary folder path
    const folderPath = `business/${businessId}`;

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
      JSON.stringify({ message: "Business deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Abort MongoDB transaction if any DB error occurs
    await session.abortTransaction();
    return handleApiError("Delete business failed!", error as string);
  } finally {
    // Close the session
    session.endSession();
  }
};
