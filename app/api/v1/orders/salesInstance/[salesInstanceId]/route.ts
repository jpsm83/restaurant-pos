import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import Order from "@/lib/db/models/order";
import User from "@/lib/db/models/user";
import BusinessGood from "@/lib/db/models/businessGood";
import SalesInstance from "@/lib/db/models/salesInstance";
import SalesPoint from "@/lib/db/models/salesPoint";

// @desc    Get orders salesInstance ID
// @route   GET /orders/salesInstance/:salesInstanceId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { salesInstanceId: Types.ObjectId };
  }
) => {
  try {
    const salesInstanceId = context.params.salesInstanceId;

    // validate salesInstanceId
    if (isObjectIdValid([salesInstanceId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "SalesInstanceId is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const orders = await Order.find({ salesInstanceId: salesInstanceId })
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        populate: {
          path: "salesPointId",
          select: "salesPointName",
          model: SalesPoint,
        },
        model: SalesInstance,
      })
      .populate({
        path: "createdByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "businessGoodId",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .populate({
        path: "addOns",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    return !orders.length
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(orders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all orders by salesInstance ID failed!", error instanceof Error ? error.message : String(error));
  }
};
