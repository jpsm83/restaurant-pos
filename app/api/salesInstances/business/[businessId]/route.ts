import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import models
import SalesLocation from "@/app/lib/models/salesInstance";
import Order from "@/app/lib/models/order";
import BusinessGood from "@/app/lib/models/businessGood";
import User from "@/app/lib/models/user";

// @desc   Get salesLocations by bussiness ID
// @route  GET /salesLocations/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    // validate salesLocationId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesLocationId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Step 1: Perform the aggregation for businessSalesLocation
    const salesLocations = await SalesLocation.aggregate([
      {
        $match: { businessId: new mongoose.Types.ObjectId(businessId) }, // Ensure to convert the printerId to an ObjectId
      },
      {
        // Lookup to join with the Business collection
        $lookup: {
          from: "businesses", // MongoDB collection name for the Business model
          localField: "salesLocationReferenceId", // Field from SalesLocation
          foreignField: "businessSalesLocation._id", // Field from Business
          as: "businessData", // Output array with the joined data
        },
      },
      {
        // Unwind the array to get individual business location objects
        $unwind: "$businessData",
      },
      {
        // Project to extract relevant businessSalesLocation details
        $addFields: {
          salesLocationReferenceData: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$businessData.businessSalesLocation", // Access the array in Business
                  as: "salesLocation",
                  cond: {
                    $eq: ["$$salesLocation._id", "$salesLocationReferenceId"], // Match the salesLocationReferenceId with the _id in the array
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        // Project only the locationReferenceName from the salesLocationReferenceData
        $project: {
          businessData: 0, // Remove the original business data
          "salesLocationReferenceData.locationType": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
          "salesLocationReferenceData.selfOrdering": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
          "salesLocationReferenceData.qrCode": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
          "salesLocationReferenceData.qrEnabled": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
        },
      },
    ]);

    // Step 2: Populate the user-related fields and order details
    await SalesLocation.populate(salesLocations, [
      {
        path: "openedById responsibleById closedById",
        select: "username currentShiftRole",
        model: User,
      },
      {
        path: "ordersIds",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodsIds",
        populate: {
          path: "businessGoodsIds",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      },
    ]);

    return !salesLocations.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesLocations found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesLocations), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Fail to get all salesLocations by business ID!",
      error
    );
  }
};
