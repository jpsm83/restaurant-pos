import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

import Rating from "@/lib/db/models/rating";
import User from "@/lib/db/models/user";

// @desc    Get ratings for a business
// @route   GET /api/v1/ratings/business/:businessId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const skipParam = url.searchParams.get("skip");
    const limit = limitParam ? Math.min(Math.max(1, Number(limitParam) || 20), 100) : 20;
    const skip = skipParam ? Math.max(0, Number(skipParam) || 0) : 0;

    const ratings = await Rating.find({ businessId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        select: "personalDetails.firstName personalDetails.lastName username",
        model: User,
      })
      .lean();

    return new NextResponse(JSON.stringify(ratings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Get ratings by business failed!", error as string);
  }
};
