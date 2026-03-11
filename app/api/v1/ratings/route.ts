import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

import Rating from "@/lib/db/models/rating";
import Business from "@/lib/db/models/business";
import { IRating } from "@/lib/interface/IRating";

// @desc    Create a rating for a business
// @route   POST /api/v1/ratings
// @access  Private (user session)
export const POST = async (req: Request) => {
  try {
    const token = await getToken({
      req: req as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.id || token.type !== "user") {
      return new NextResponse(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const userId = new Types.ObjectId(token.id as string);

    const body = (await req.json()) as {
      businessId: Types.ObjectId;
      orderId?: Types.ObjectId;
      score: number;
      comment?: string;
    };
    const { businessId, orderId, score, comment } = body;

    if (!businessId || score === undefined) {
      return new NextResponse(
        JSON.stringify({ message: "businessId and score are required!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (
      typeof score !== "number" ||
      Number.isNaN(score) ||
      score < 0 ||
      score > 5
    ) {
      return new NextResponse(
        JSON.stringify({ message: "score must be a number between 0 and 5!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const idsToValidate = [businessId];
    if (orderId) idsToValidate.push(orderId);
    if (isObjectIdValid(idsToValidate) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId or orderId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const ratingDoc: IRating = {
      businessId,
      userId,
      score,
      comment: comment || undefined,
    };
    if (orderId) ratingDoc.orderId = orderId;

    const created = await Rating.create(ratingDoc);
    if (!created) {
      return new NextResponse(
        JSON.stringify({ message: "Failed to create rating" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const ratings = await Rating.find({ businessId }).select("score").lean();
    const count = ratings.length;
    const sum = ratings.reduce((acc, r) => acc + (r.score ?? 0), 0);
    const averageRating = count > 0 ? sum / count : 0;

    await Business.updateOne(
      { _id: businessId },
      { $set: { averageRating, ratingCount: count } }
    );

    return new NextResponse(JSON.stringify(created), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Create rating failed!", error as string);
  }
};
