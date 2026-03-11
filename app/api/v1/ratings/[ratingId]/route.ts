import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

import Rating from "@/lib/db/models/rating";
import User from "@/lib/db/models/user";

// @desc    Get a rating by ID
// @route   GET /api/v1/ratings/:ratingId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { ratingId: Types.ObjectId } }
) => {
  try {
    const ratingId = context.params.ratingId;

    if (isObjectIdValid([ratingId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid ratingId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const rating = await Rating.findById(ratingId)
      .populate({
        path: "userId",
        select: "personalDetails.firstName personalDetails.lastName username",
        model: User,
      })
      .lean();

    if (!rating) {
      return new NextResponse(
        JSON.stringify({ message: "Rating not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(JSON.stringify(rating), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Get rating by id failed!", error as string);
  }
};
