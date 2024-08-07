import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import BusinessGood from "@/app/lib/models/businessGood";
import Promotion from "@/app/lib/models/promotion";
import Order from "@/app/lib/models/order";
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validateIngredients } from "../utils/validateIngredients";
import { calculateIngredientsCostPriceAndAllergies } from "../utils/calculateIngredientsCostPriceAndAllergies";
import { calculateSetMenuCostPriceAndAllergies } from "../utils/calculateSetMenuCostPriceAndAllergies";

// @desc    Get business good by ID
// @route   GET /businessGoods/:businessGoodId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessGoodId: Types.ObjectId } }
) => {
  try {
    const businessGoodId = context.params.businessGoodId;

    if (!businessGoodId || !Types.ObjectId.isValid(businessGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const businessGood = await BusinessGood.findById(businessGoodId)
      .populate("ingredients.ingredient", "name category")
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
      category,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      ingredients,
      setMenu,
      description,
      image,
      deliveryTime,
    } = (await req.json()) as IBusinessGood;

    // check if businessGoodId is valid
    if (!businessGoodId || !Types.ObjectId.isValid(businessGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // one of the two fields should be present (ingredients or setMenu)
    if (ingredients && setMenu) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one of ingredients or setMenu can be asigned!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the business good exists
    const businessGood = (await BusinessGood.findById(
      businessGoodId
    ).lean()) as IBusinessGood;

    if (!businessGood) {
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check for duplicate names
    const duplicateBusinessGood = await BusinessGood.findOne({
      _id: { $ne: businessGoodId },
      business: businessGood.business,
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
    const updatedBusinessGood: IBusinessGood = {
      name: name || businessGood.name,
      keyword: keyword || businessGood.keyword,
      category: {
        mainCategory: category as unknown as string,
        setMenuSubCategory: undefined,
        foodSubCategory: undefined,
        beverageSubCategory: undefined,
        merchandiseSubCategory: undefined,
      },
      onMenu: onMenu || businessGood.onMenu,
      available: available || businessGood.available,
      sellingPrice: sellingPrice || businessGood.sellingPrice,
      description: description || businessGood.description,
      image: image || businessGood.image,
      deliveryTime: deliveryTime || businessGood.deliveryTime,
    };

    // set the category and subcategory
    switch (category as unknown as string) {
      case "Set Menu":
        updatedBusinessGood.category.setMenuSubCategory = subCategory;
        break;
      case "Food":
        updatedBusinessGood.category.foodSubCategory = subCategory;
        break;
      case "Beverage":
        updatedBusinessGood.category.beverageSubCategory = subCategory;
        break;
      case "Merchandise":
        updatedBusinessGood.category.merchandiseSubCategory = subCategory;
        break;
      default:
        updatedBusinessGood.category.merchandiseSubCategory = "No subcategory";
        break;
    }

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
        updatedBusinessGood.ingredients =
          calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
            return {
              ingredient: ing.ingredient,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });
        updatedBusinessGood.costPrice =
          calculateIngredientsCostPriceAndAllergiesResult.reduce(
            (acc, curr) => acc + curr.costOfRequiredQuantity,
            0
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
        updatedBusinessGood.allergens =
          reducedAllergens && reducedAllergens.length > 0
            ? reducedAllergens
            : [];
      }
      // @ts-ignore
      updatedBusinessGood.$unset = { setMenu: "" }; // This removes the setMenu field
    }

    // calculate the cost price and allergens for the setMenu if they exist
    if (setMenu) {
      const calculateSetMenuCostPriceAndAllergiesResult =
        await calculateSetMenuCostPriceAndAllergies(setMenu);
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
        updatedBusinessGood.setMenu = setMenu;
        updatedBusinessGood.costPrice =
          calculateSetMenuCostPriceAndAllergiesResult.costPrice;
        updatedBusinessGood.allergens =
          calculateSetMenuCostPriceAndAllergiesResult.allergens &&
          calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
            ? calculateSetMenuCostPriceAndAllergiesResult.allergens
            : [];
      }
      // @ts-ignore
      updatedBusinessGood.$unset = { ingredients: "" }; // This removes the ingredients field
    }

    // update the business good
    await BusinessGood.findByIdAndUpdate(
      { _id: businessGoodId },
      updatedBusinessGood,
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({
        message: `Business good ${updatedBusinessGood.name} updated successfully!`,
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
  try {
    const businessGoodId = context.params.businessGoodId;

    // check if businessGoodId is valid
    if (!businessGoodId || !Types.ObjectId.isValid(businessGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the business good is used in any order
    const businessGoodInOrders = await Order.find({
      businessGoods: businessGoodId,
      billingStatus: "Open",
    }).lean();
    if (businessGoodInOrders.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Cannot delete Business good because it is in some orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the business good is used in any set menu
    const businessGoodInSetMenu = await BusinessGood.find({
      setMenu: businessGoodId,
    }).lean();
    if (businessGoodInSetMenu.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Cannot delete Business good because it is in some set menu!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete and check if the business good exists
    const result = await BusinessGood.deleteOne({ _id: businessGoodId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the business good id reference from promotions
    await Promotion.updateMany(
      { businessGoodsToApply: businessGoodId },
      { $pull: { businessGoodsToApply: businessGoodId } }
    );

    return new NextResponse(
      JSON.stringify({
        message: `Business good ${businessGoodId} deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete business good failed!", error);
  }
};
