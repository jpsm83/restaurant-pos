import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Promotion from "@/app/lib/models/promotion";
import BusinessGood from "@/app/lib/models/businessGood";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get promotion by business ID with optional date range
// @route   GET /promotion/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // Validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query based on the presence of startDate and endDate
    let query: {
      businessId: Types.ObjectId;
      "promotionPeriod.start"?: { $gte: Date };
      "promotionPeriod.end"?: { $lte: Date };
    } = { businessId: businessId };

    if (startDate && endDate) {
      if (startDate > endDate) {
        return new NextResponse(
          JSON.stringify({
            message: "Invalid date range, start date must be before end date!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      query["promotionPeriod.start"] = { $gte: new Date(startDate) };
      query["promotionPeriod.end"] = { $lte: new Date(endDate) };
    }

    // Connect to DB before first call
    await connectDb();

    const promotion = await Promotion.find(query)
    .populate({
      path: "businessGoodsToApplyIds",
      select: "name",
      model: BusinessGood,
    })
    .lean();

    return !promotion.length
      ? new NextResponse(JSON.stringify({ message: "No promotion found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(promotion), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get promotion by business id failed!", error);
  }
};
