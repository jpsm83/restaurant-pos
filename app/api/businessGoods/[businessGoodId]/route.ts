import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validateIngredients } from "../utils/validateIngredients";
import { calculateIngredientsCostPriceAndAllergies } from "../utils/calculateIngredientsCostPriceAndAllergies";
import { calculateSetMenuCostPriceAndAllergies } from "../utils/calculateSetMenuCostPriceAndAllergies";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";

// imported models
import BusinessGood from "@/app/lib/models/businessGood";
import Promotion from "@/app/lib/models/promotion";
import Order from "@/app/lib/models/order";
import SupplierGood from "@/app/lib/models/supplierGood";

// @desc    Get business good by ID
// @route   GET /businessGoods/:businessGoodId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessGoodId: Types.ObjectId } }
) => {
  try {
    const businessGoodId = context.params.businessGoodId;

    if (isObjectIdValid([businessGoodId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const businessGood = await BusinessGood.findById(businessGoodId)
      .populate({
        path: "ingredients.supplierGoodId",
        select: "name mainCategory subCategory",
        model: SupplierGood,
      })
      .populate({
        path: "setMenuIds",
        select: "name mainCategory subCategory sellingPrice",
        model: SupplierGood,
      })
      .lean();

    return !businessGood
      ? new NextResponse(
          JSON.stringify({ message: "No business good found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(businessGood), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get business good by its id failed!", error);
  }
};

// @desc    Update business good by ID
// @route   PUT /businessGoods/:businessGoodId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { businessGoodId: Types.ObjectId } }
) => {
  try {
    const businessGoodId = context.params.businessGoodId;
    const {
      name,
      keyword,
      mainCategory,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      ingredients,
      setMenuIds,
      grossProfitMarginDesired,
      description,
      deliveryTime,
    } = (await req.json()) as IBusinessGood;

    // check if businessGoodId is valid
    if (isObjectIdValid([businessGoodId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // At least one of the two fields should be present (ingredients or setMenuIds), but not both
    if (!ingredients && !setMenuIds) {
      return new NextResponse(
        JSON.stringify({
          message:
            "At least one of ingredients or setMenuIds must be assigned!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (ingredients && setMenuIds) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one of ingredients or setMenuIds can be assigned!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if the business good exists
    const businessGood: IBusinessGood | null = await BusinessGood.findById(
      businessGoodId
    )
      .select("businessId")
      .lean();

    if (!businessGood) {
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check for duplicate names
    const duplicateBusinessGood = await BusinessGood.exists({
      _id: { $ne: businessGoodId },
      businessId: businessGood.businessId,
      name,
    });

    if (duplicateBusinessGood) {
      return new NextResponse(
        JSON.stringify({ message: `Business good ${name} already exists!` }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // prepare the update object
    const updatedBusinessGoodObj: Partial<IBusinessGood> = {};

    if (name) updatedBusinessGoodObj.name = name;
    if (keyword) updatedBusinessGoodObj.keyword = keyword;
    if (mainCategory) updatedBusinessGoodObj.mainCategory = mainCategory;
    if (subCategory) updatedBusinessGoodObj.subCategory = subCategory;
    if (onMenu !== undefined) updatedBusinessGoodObj.onMenu = onMenu;
    if (available !== undefined) updatedBusinessGoodObj.available = available;
    if (sellingPrice) updatedBusinessGoodObj.sellingPrice = sellingPrice;
    if (grossProfitMarginDesired)
      updatedBusinessGoodObj.grossProfitMarginDesired =
        grossProfitMarginDesired;
    if (description) updatedBusinessGoodObj.description = description;
    if (deliveryTime) updatedBusinessGoodObj.deliveryTime = deliveryTime;

    // validate ingredients if they exist and calculate the cost price and allergens
    if (ingredients) {
      const validateIngredientsResult = validateIngredients(ingredients);
      if (validateIngredientsResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: validateIngredientsResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const calculateIngredientsCostPriceAndAllergiesResult =
        await calculateIngredientsCostPriceAndAllergies(ingredients);
      if (typeof calculateIngredientsCostPriceAndAllergiesResult !== "object") {
        return new NextResponse(
          JSON.stringify({
            message: calculateIngredientsCostPriceAndAllergiesResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        updatedBusinessGoodObj.ingredients =
          calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
            return {
              supplierGoodId: ing.supplierGoodId,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });
        updatedBusinessGoodObj.costPrice = parseFloat(
          calculateIngredientsCostPriceAndAllergiesResult
            .reduce((acc, curr) => acc + curr.costOfRequiredQuantity, 0)
            .toFixed(2)
        );
        const reducedAllergens =
          calculateIngredientsCostPriceAndAllergiesResult.reduce(
            (acc: string[], curr) => {
              if (curr.allergens) {
                curr.allergens.forEach((allergen) => {
                  if (!acc.includes(allergen)) {
                    acc.push(allergen);
                  }
                });
              }
              return acc;
            },
            []
          );
        updatedBusinessGoodObj.allergens =
          reducedAllergens && reducedAllergens.length > 0
            ? reducedAllergens
            : [];
      }

      updatedBusinessGoodObj.setMenuIds = []; // This removes the setMenuIds field
    }

    // calculate the cost price and allergens for the setMenuIds if they exist
    if (setMenuIds) {
      const calculateSetMenuCostPriceAndAllergiesResult =
        await calculateSetMenuCostPriceAndAllergies(setMenuIds);
      if (typeof calculateSetMenuCostPriceAndAllergiesResult !== "object") {
        return new NextResponse(
          JSON.stringify({
            message: calculateSetMenuCostPriceAndAllergiesResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        updatedBusinessGoodObj.setMenuIds = setMenuIds;
        updatedBusinessGoodObj.costPrice = parseFloat(
          calculateSetMenuCostPriceAndAllergiesResult.costPrice.toFixed(2)
        );
        updatedBusinessGoodObj.allergens =
          calculateSetMenuCostPriceAndAllergiesResult.allergens &&
          calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
            ? calculateSetMenuCostPriceAndAllergiesResult.allergens
            : [];
      }

      updatedBusinessGoodObj.ingredients = []; // This removes the ingredients field
    }

    // calculate suggestedSellingPrice
    if (
      updatedBusinessGoodObj.costPrice &&
      updatedBusinessGoodObj.grossProfitMarginDesired
    ) {
      updatedBusinessGoodObj.suggestedSellingPrice = parseFloat(
        (
          (updatedBusinessGoodObj.costPrice ?? 0) /
          (1 - (updatedBusinessGoodObj.grossProfitMarginDesired ?? 0) / 100)
        ).toFixed(2)
      );
    }

    // update the business good
    await BusinessGood.updateOne(
      { _id: businessGoodId },
      { $set: updatedBusinessGoodObj }
    );

    return new NextResponse(
      JSON.stringify({
        message: `Business good updated successfully!`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update business good failed!", error);
  }
};

// delete a business goods shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a business goods should be deleted is if the business itself is deleted
// or if the business good is not used in any order or set menu
// @desc    Delete business good by ID
// @route   DELETE /businessGoods/:businessGoodId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { businessGoodId: Types.ObjectId } }
) => {
  const businessGoodId = context.params.businessGoodId;

  // check if businessGoodId is valid
  if (isObjectIdValid([businessGoodId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid businessGoodId!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [businessGoodInOrders, businessGoodInSetMenu] = await Promise.all([
      // check if the business good is used in any order.billingStatus: "Open"
      Order.exists({
        businessGoodsIds: businessGoodId,
        billingStatus: "Open",
      }),
      // check if the business good is used in any set menu
      BusinessGood.exists({
        setMenuIds: businessGoodId,
      }),
    ]);

    if (businessGoodInOrders) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message:
            "Cannot delete Business good because it is in some open orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (businessGoodInSetMenu) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message:
            "Cannot delete Business good because it is in some set menu!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete and check if the business good exists
    const result = await BusinessGood.deleteOne(
      {
        _id: businessGoodId,
      },
      { session }
    );

    if (result.deletedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the business good id reference from promotions
    const updatedPromotion = await Promotion.updateMany(
      { businessGoodsToApplyIds: businessGoodId },
      { $pull: { businessGoodsToApplyIds: businessGoodId } },
      { session }
    );

    if (updatedPromotion.modifiedCount > 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: `Business good ${businessGoodId} is used in promotions!`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Business good ${businessGoodId} deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete business good failed!", error);
  } finally {
    session.endSession();
  }
};
