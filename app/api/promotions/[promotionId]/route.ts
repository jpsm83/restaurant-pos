import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { validateDateAndTime } from "../utils/validateDateAndTime";
import { validateDaysOfTheWeek } from "../utils/validateDaysOfTheWeek";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validatePromotionType } from "../utils/validatePromotionType";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IPromotion } from "@/app/lib/interface/IPromotion";

// imported models
import Promotion from "@/app/lib/models/promotion";
import BusinessGood from "@/app/lib/models/businessGood";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get promotion by ID
// @route   GET /promotions/:promotionId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { promotionId: Types.ObjectId } }
) => {
  try {
    const promotionId = context.params.promotionId;

    // check if the promotionId is valid
    if (isObjectIdValid([promotionId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid promotionId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const promotion = await Promotion.findById(promotionId)
      .populate({
        path: "businessGoodsToApplyIds",
        select: "name",
        model: BusinessGood,
      })
      .lean();

    return !promotion
      ? new NextResponse(JSON.stringify({ message: "Promotion  not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(promotion), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get promotion by its id failed!", error);
  }
};

// @desc    Update promotion by ID
// @route   PATCH /promotions/:promotionId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { promotionId: Types.ObjectId } }
) => {
  try {
    const promotionId = context.params.promotionId;

    // check if the promotionId is valid
    if (isObjectIdValid([promotionId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid promotionId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const {
      promotionName,
      promotionPeriod,
      weekDays,
      activePromotion,
      promotionType,
      businessGoodsToApplyIds,
      description,
    } = (await req.json()) as IPromotion;

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
    if (promotionPeriod) {
      const validateDateAndTimeResult = validateDateAndTime(promotionPeriod);

      if (validateDateAndTimeResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: validateDateAndTimeResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // validate weekDays
    if (weekDays) {
      const validateDaysOfTheWeekResult = validateDaysOfTheWeek(weekDays);

      if (validateDaysOfTheWeekResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: validateDaysOfTheWeekResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // validate promotionType
    if (promotionType) {
      const validatePromotionTypeResult = validatePromotionType(promotionType);
      if (validatePromotionTypeResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: validatePromotionTypeResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // check if the promotion exists
    const promotion: IPromotion | null = await Promotion.findById(promotionId)
      .select("businessId")
      .lean();

    if (!promotion) {
      return new NextResponse(
        JSON.stringify({ message: "Promotion not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check duplicate promotion
    const duplicatePromotion = await Promotion.exists({
      _id: { $ne: promotionId },
      businessId: promotion.businessId,
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

    // prepare update object
    const updatedPromotion: Partial<IPromotion> = {};

    if (promotionName) updatedPromotion.promotionName = promotionName;
    if (promotionPeriod) updatedPromotion.promotionPeriod = promotionPeriod;
    if (weekDays) updatedPromotion.weekDays = weekDays;
    if (activePromotion) updatedPromotion.activePromotion = activePromotion;
    if (promotionType) updatedPromotion.promotionType = promotionType;
    if (businessGoodsToApplyIds)
      updatedPromotion.businessGoodsToApplyIds = businessGoodsToApplyIds;
    if (description) updatedPromotion.description = description;

    // save the updated promotion
    await Promotion.updateOne(
      { _id: promotionId},
      { $set: updatedPromotion },
    );

    return new NextResponse(
      JSON.stringify({
        message: "Promotion updated successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update promotion failed!", error);
  }
};

// @desc    Delete promotion by ID
// @route   DELETE /promotions/:promotionId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { promotionId: Types.ObjectId } }
) => {
  try {
    const promotionId = context.params.promotionId;

    // check if the promotionId is valid
    if (isObjectIdValid([promotionId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid promotionId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete promotion and check if it existed
    const result = await Promotion.deleteOne({ _id: promotionId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Promotion not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Promotion ${promotionId} deleted!` }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete promotion failed!", error);
  }
};
