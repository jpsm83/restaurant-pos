import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validateIngredients } from "./utils/validateIngredients";
import { calculateIngredientsCostPriceAndAllergies } from "./utils/calculateIngredientsCostPriceAndAllergies";
import { calculateSetMenuCostPriceAndAllergies } from "./utils/calculateSetMenuCostPriceAndAllergies";

// imported interfaces
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";

// imported models
import BusinessGood from "@/app/lib/models/businessGood";
import SupplierGood from "@/app/lib/models/supplierGood";

// @desc    Get all businessId goods
// @route   GET /businessGoods
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const businessGoods = await BusinessGood.find()
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

    return !businessGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No businessId goods found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(businessGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all businessId goods failed!", error);
  }
};

// @desc    Create new businessId good
// @route   POST /businessGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      mainCategory,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      businessId,
      ingredients,
      setMenuIds,
      grossProfitMarginDesired,
      description,
      deliveryTime,
    } = (await req.json()) as IBusinessGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !mainCategory ||
      !subCategory ||
      onMenu === undefined ||
      available === undefined ||
      !sellingPrice ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, subcategory, onMenu, available, sellingPrice and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Business ID is not valid!" }),
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

    // check for duplicate businessId good
    const duplicateBusinessGood = await BusinessGood.exists({
      businessId,
      name,
    });

    if (duplicateBusinessGood) {
      return new NextResponse(
        JSON.stringify({
          message: `${name} already exists on businessId goods!`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // create a businessId good object
    let newBusinessGood: IBusinessGood = {
      name,
      keyword,
      mainCategory,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      businessId,
      description: description || undefined,
      grossProfitMarginDesired: grossProfitMarginDesired || undefined,
      deliveryTime: deliveryTime || undefined,
    };

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
        newBusinessGood.ingredients =
          calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
            return {
              supplierGoodId: ing.supplierGoodId,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });
        newBusinessGood.setMenuIds = undefined;
        newBusinessGood.costPrice = parseFloat(
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
        newBusinessGood.allergens =
          reducedAllergens && reducedAllergens.length > 0
            ? reducedAllergens
            : undefined;
      }
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
        newBusinessGood.ingredients = undefined;
        newBusinessGood.setMenuIds = setMenuIds;
        newBusinessGood.costPrice = parseFloat(
          calculateSetMenuCostPriceAndAllergiesResult.costPrice.toFixed(2)
        );
        newBusinessGood.allergens =
          calculateSetMenuCostPriceAndAllergiesResult.allergens &&
          calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
            ? calculateSetMenuCostPriceAndAllergiesResult.allergens
            : undefined;
      }
    }

    // calculate suggestedSellingPrice
    if (newBusinessGood.costPrice && grossProfitMarginDesired) {
      newBusinessGood.suggestedSellingPrice = parseFloat(
        (
          (newBusinessGood.costPrice ?? 0) /
          (1 - (grossProfitMarginDesired ?? 0) / 100)
        ).toFixed(2)
      );
    }

    // create the new businessId good
    await BusinessGood.create(newBusinessGood);

    return new NextResponse(
      JSON.stringify({
        message: `BusinessId good ${name} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create businessId good failed!", error);
  }
};

// export const POST = async (req: Request) => {
//   try {
//     const ingredientsArr: any = [
//       {
//         ingredient: "667bfac8d28a7ee19d9be443",
//         measurementUnit: "unit",
//         requiredQuantity: 1,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be444",
//         measurementUnit: "g",
//         requiredQuantity: 0.5,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be445",
//         measurementUnit: "unit",
//         requiredQuantity: 1,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be446",
//         measurementUnit: "g",
//         requiredQuantity: 20,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be447",
//         measurementUnit: "g",
//         requiredQuantity: 10,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be44c",
//         measurementUnit: "g",
//         requiredQuantity: 15,
//       },
//     ];

//     // cheeseburger - fries
//     const setMenuArr = ["667bfc0c5d50be40f0c7b065", "667bfddd5d50be40f0c7b079"];

//     await connectDb();

//     // // @ts-ignore
//     // const ingredients = await calculateIngredientsCostPriceAndAllergies(
//     //   ingredientsArr
//     // );
//     // return new NextResponse(JSON.stringify(ingredients), {
//     //   status: 201,
//     //   headers: { "Content-Type": "application/json" },
//     // });

//     // @ts-ignore
//     const setMenuIds = await calculateSetMenuCostPriceAndAllergies(setMenuArr);
//     return new NextResponse(JSON.stringify(setMenuIds), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });

//     // // @ts-ignore
//     // const validate = validateIngredients(ingredientsArr);
//     // return new NextResponse(JSON.stringify(validate), {
//     //   status: 201,
//     //   headers: { "Content-Type": "application/json" },
//     // });
//   } catch (error) {
//     return handleApiError("Create schedule failed!", error);
//   }
// };
