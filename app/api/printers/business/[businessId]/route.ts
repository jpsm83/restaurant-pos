import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";

// @desc    Get printers by businessId ID
// @route   GET /printers/businessId/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // check if businessId is valid
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

    // Step 1: Perform the aggregation for businessSalesPoint
    const printers = await Printer.aggregate([
      {
        $match: { businessId: new mongoose.Types.ObjectId(businessId) }, // Ensure to convert the printerId to an ObjectId
      },
  // Step 1: Unwind configurationSetupToPrintOrders array with 'preserveNullAndEmptyArrays'
  { 
    $unwind: {
      path: "$configurationSetupToPrintOrders",
      preserveNullAndEmptyArrays: true,
    }
  },
  // Step 2: Unwind businessSalesPointReferenceIds array with 'preserveNullAndEmptyArrays'
  {
    $unwind: {
      path: "$configurationSetupToPrintOrders.businessSalesPointReferenceIds",
      preserveNullAndEmptyArrays: true,
    },
  },
  // Step 3: Lookup to fetch Business based on businessSalesPointReferenceIds
  {
    $lookup: {
      from: "businesses", // The Business collection
      let: {
        businessId: "$businessId",
        locationId: "$configurationSetupToPrintOrders.businessSalesPointReferenceIds",
      },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$businessId"] } } }, // Match the correct business by its ID
        { $unwind: "$businessSalesPoint" }, // Unwind the businessSalesPoint array
        {
          $match: {
            $expr: { $eq: ["$businessSalesPoint._id", "$$locationId"] },
          },
        }, // Match businessSalesPoint with the reference IDs
        {
          $project: {
            "businessSalesPoint.locationReferenceName": 1, // Adjust based on the fields you need
          },
        },
      ],
      as: "businessSalesPointReferenceData",
    },
  },
  // Step 4: Lookup to fetch Users based on excludeUserIds, handling missing excludeUserIds
  {
    $lookup: {
      from: "users", // The User collection
      let: {
        excludeUsers: { $ifNull: ["$configurationSetupToPrintOrders.excludeUserIds", []] }, // If excludeUserIds is null, default to an empty array
      },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$excludeUsers"] } } }, // Match the correct users based on excludeUserIds
        {
          $project: {
            username: 1, // Return the username field
          },
        },
      ],
      as: "excludedUsers", // Alias to hold the populated excludeUserIds data
    },
  },
  // Step 5: Group data back into printer level with configuration and excluded users
  {
    $group: {
      _id: "$_id",
      printerAlias: { $first: "$printerAlias" },
      description: { $first: "$description" },
      printerStatus: { $first: "$printerStatus" },
      ipAddress: { $first: "$ipAddress" },
      port: { $first: "$port" },
      businessId: { $first: "$businessId" },
      backupPrinterId: { $first: "$backupPrinterId" },
      usersAllowedToPrintDataIds: { $first: "$usersAllowedToPrintDataIds" },
      configurationSetupToPrintOrders: {
        $push: {
          businessSalesPointReferenceIds:
            "$configurationSetupToPrintOrders.businessSalesPointReferenceIds",
          businessSalesPointReferenceData:
            "$businessSalesPointReferenceData",
          mainCategory: "$configurationSetupToPrintOrders.mainCategory",
          subCategories: "$configurationSetupToPrintOrders.subCategories",
          excludedUsers: "$excludedUsers", // Include the populated excluded users here
        },
      },
    },
  },
]);

    // Step 7: Populate the user-related fields and order details
    await Printer.populate(printers, [
      {
        path: "backupPrinterId",
        select: "printerAlias",
        model: Printer,
      },
      {
        path: "usersAllowedToPrintDataIds",
        select: "username",
        model: User,
      },
    ]);

    return !printers.length
      ? new NextResponse(JSON.stringify({ message: "No printers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get printers by businessId id failed!", error);
  }
};
