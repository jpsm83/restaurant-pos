import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import { handleApiError } from "@/lib/db/handleApiError";
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// import models
import SalesInstance from "@/lib/db/models/salesInstance";
import BusinessGood from "@/lib/db/models/businessGood";
import Order from "@/lib/db/models/order";
import SalesPoint from "@/lib/db/models/salesPoint";
import User from "@/lib/db/models/user";

// @desc   Get salesInstances by user ID (opened by or responsible by)
// @route  GET /salesInstances/user/:userId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (isObjectIdValid([userId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid userId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectDb();

    const salesInstances = await SalesInstance.find({
      $or: [
        { openedByUserId: userId },
        { responsibleByUserId: userId },
      ],
    })
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
        model: Order,
      })
      .lean();

    return !salesInstances.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesInstances found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstances), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Fail to get all salesInstances by user ID!",
      error instanceof Error ? error.message : String(error)
    );
  }
};
