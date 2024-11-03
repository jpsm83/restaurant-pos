import { NextResponse } from "next/server";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { validateDateAndTime } from "./utils/validateDateAndTime";
import { validateDaysOfTheWeek } from "./utils/validateDaysOfTheWeek";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validatePromotionType } from "./utils/validatePromotionType";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IPromotion } from "@/app/lib/interface/IPromotion";

// imported models
import Promotion from "@/app/lib/models/promotion";
import BusinessGood from "@/app/lib/models/businessGood";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get all promotion
// @route   GET /promotions
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const promotion = await Promotion.find()
      .populate({
        path: "businessGoodsToApplyIds",
        select: "name",
        model: BusinessGood,
      })
      .lean();

    return !promotion.length
      ? new NextResponse(JSON.stringify({ message: "No promotion  found!" }), {
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
    return handleApiError("Get all promotions failed!", error);
  }
};

// @desc    Create new promotion
// @route   POST /promotions
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      promotionName,
      promotionPeriod,
      weekDays,
      activePromotion,
      promotionType,
      businessId,
      businessGoodsToApplyIds,
      description,
    } = (await req.json()) as IPromotion;

    // check required fields
    if (
      !promotionName ||
      !promotionPeriod ||
      !weekDays ||
      activePromotion === undefined ||
      !promotionType ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PromotionName, promotionPeriod, weekDays, activePromotion, promotionType and business are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessGoodsToApplyIds
    if (businessGoodsToApplyIds) {
      if (!Array.isArray(businessGoodsToApplyIds)) {
        return new NextResponse(
          JSON.stringify({
            message:
              "BusinessGoodsToApply should be an array of business goods IDs!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      for (const businessGoodId of businessGoodsToApplyIds) {
        if (isObjectIdValid([businessGoodId]) !== true) {
          return new NextResponse(
            JSON.stringify({ message: "BusinessGoodsToApply IDs not valid!" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // validate dateRange and timeRange
    const validateDateAndTimeResult = validateDateAndTime(promotionPeriod);

    if (validateDateAndTimeResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validateDateAndTimeResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate weekDays
    const validateDaysOfTheWeekResult = validateDaysOfTheWeek(weekDays);

    if (validateDaysOfTheWeekResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validateDaysOfTheWeekResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate promotionType
    const validatePromotionTypeResult = validatePromotionType(promotionType);
    if (validatePromotionTypeResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validatePromotionTypeResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate promotion
    const duplicatePromotion = await Promotion.exists({
      businessId,
      promotionName,
    });

    if (duplicatePromotion) {
      return new NextResponse(
        JSON.stringify({
          message: `Promotion ${promotionName} already exists!`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // create promotion object
    const newPromotion = {
      promotionName,
      promotionPeriod,
      weekDays,
      activePromotion,
      promotionType,
      businessId,
      businessGoodsToApply: businessGoodsToApplyIds || undefined,
      description: description || undefined,
    };

    // create a new promotion
    await Promotion.create(newPromotion);

    return new NextResponse(
      JSON.stringify({
        message: `Promotion ${promotionName} created successfully!`,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create promotion failed!", error);
  }
};
