import { NextResponse } from "next/server";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { handleApiError } from "@/lib/db/handleApiError";
import { calculateIngredientsCostPriceAndAllergies } from "./utils/calculateIngredientsCostPriceAndAllergies";
import { calculateSetMenuCostPriceAndAllergies } from "./utils/calculateSetMenuCostPriceAndAllergies";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";

// imported interfaces
import { IBusinessGood, IIngredient } from "@/lib/interface/IBusinessGood";

// imported models
import BusinessGood from "@/lib/db/models/businessGood";
import SupplierGood from "@/lib/db/models/supplierGood";

// imported enums
import {
  mainCategoriesEnums,
  allergensEnums,
  measurementUnitEnums,
} from "@/lib/enums";

// @desc    Get all businessId goods
// @route   GET /businessGoods
// @access  Private
export const GET = async () => {
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
    return handleApiError("Get all businessId goods failed!", error as string);
  }
};

// @desc    Create new businessId good
// @route   POST /businessGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract required fields
    const name = formData.get("name") as string;
    const keyword = formData.get("keyword") as string;
    const mainCategory = formData.get("mainCategory") as string;
    const onMenu = formData.get("onMenu") === "true";
    const available = formData.get("available") === "true";
    const sellingPrice = Number(formData.get("sellingPrice")) as number;
    const businessId = formData.get("businessId") as string;

    // Extract optional fields
    const subCategory = formData.get("subCategory") as string | undefined;
    const ingredients = formData.get("ingredients")
      ? (JSON.parse(formData.get("ingredients") as string) as IIngredient[])
      : undefined;
    const setMenuIds = formData.get("setMenuIds")
      ? (JSON.parse(formData.get("setMenuIds") as string) as string[])
      : [];
    const grossProfitMarginDesired = formData.get("grossProfitMarginDesired")
      ? Number(formData.get("grossProfitMarginDesired"))
      : undefined;
    const description = formData.get("description") as string | undefined;
    const allergens = formData.get("allergens")
      ? (JSON.parse(formData.get("allergens") as string) as string[])
      : [];
    const deliveryTime = formData.get("deliveryTime")
      ? Number(formData.get("deliveryTime"))
      : undefined;

    const files = formData
      .getAll("imagesUrl")
      .filter((entry): entry is File => entry instanceof File); // Get all files

    // check required fields
    if (
      !name ||
      !keyword ||
      !mainCategory ||
      onMenu === undefined ||
      available === undefined ||
      !sellingPrice ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, onMenu, available, sellingPrice and businessId are required!",
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

    // ingredients and setMenuIds cannot be assigned at the same time
    if (ingredients && ingredients?.length > 0 && setMenuIds?.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one of ingredients or setMenuIds can be assigned!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if main category is valid
    if (!mainCategoriesEnums.includes(mainCategory)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid main category!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if allergens are valid
    if (allergens.length > 0) {
      for (const allergen of allergens) {
        if (!allergensEnums.includes(allergen)) {
          return new NextResponse(
            JSON.stringify({ message: "Invalid allergen!" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // check if measurementUnit is valid
    if (ingredients) {
      for (const ingredient of ingredients) {
        if (!measurementUnitEnums.includes(ingredient.measurementUnit)) {
          return new NextResponse(
            JSON.stringify({ message: "Invalid measurement unit!" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
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

    const businessGoodId = new mongoose.Types.ObjectId();

    // create a businessId good object
    const newBusinessGood: IBusinessGood = {
      _id: businessGoodId,
      name,
      keyword,
      mainCategory,
      onMenu,
      available,
      sellingPrice,
      businessId,
      subCategory: subCategory || undefined,
      setMenuIds: setMenuIds || undefined,
      grossProfitMarginDesired: grossProfitMarginDesired || undefined,
      description: description || undefined,
      deliveryTime: deliveryTime || undefined,
    };

    // upload image
    if (files?.every((file) => file instanceof File && file.size > 0)) {
      const folder = `/business/${businessId}/businessGoods/${businessGoodId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: files,
        onlyImages: true,
      });

      if (
        typeof cloudinaryUploadResponse === "string" ||
        cloudinaryUploadResponse.length === 0 ||
        !cloudinaryUploadResponse.every((str) => str.includes("https://"))
      ) {
        return new NextResponse(
          JSON.stringify({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      newBusinessGood.imagesUrl = cloudinaryUploadResponse;
    }

    // validate ingredients if they exist and calculate the cost price and allergens
    if (ingredients && ingredients.length > 0) {
      // this calcutation return an array of objects with the cost price and allergens
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
      }

      // add the ingredients array to the new businessId good
      newBusinessGood.ingredients =
        calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
          return {
            supplierGoodId: ing.supplierGoodId,
            measurementUnit: ing.measurementUnit,
            requiredQuantity: ing.requiredQuantity ?? 0,
            costOfRequiredQuantity: ing.costOfRequiredQuantity,
          };
        });

      // if there is ingredients, setMenuIds should be undefined
      newBusinessGood.setMenuIds = undefined;

      // calculate the cost price of all ingredients
      newBusinessGood.costPrice = parseFloat(
        calculateIngredientsCostPriceAndAllergiesResult
          .reduce((acc, curr) => acc + curr.costOfRequiredQuantity, 0)
          .toFixed(2)
      );

      // create an array of allergens
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

      const allergensArr = [...allergens];
      allergensArr.push(
        ...reducedAllergens.filter((item) => !allergensArr.includes(item))
      );

      newBusinessGood.allergens =
        allergensArr.length > 0 ? allergensArr : undefined;
    }

    // calculate the cost price and allergens for the setMenuIds if they exist
    if (setMenuIds && setMenuIds.length > 0) {
      // this calcutation return an object with the cost price and allergens
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
      }

      // if there is setMenuIds, ingredients should be undefined
      newBusinessGood.ingredients = undefined;

      // add the setMenuIds array to the new businessId good
      newBusinessGood.setMenuIds = setMenuIds;

      // calculate the sum of all cost prices
      newBusinessGood.costPrice = parseFloat(
        calculateSetMenuCostPriceAndAllergiesResult.costPrice.toFixed(2)
      );

      // add the allergens to the new businessId good
      newBusinessGood.allergens =
        calculateSetMenuCostPriceAndAllergiesResult.allergens &&
        calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
          ? calculateSetMenuCostPriceAndAllergiesResult.allergens
          : undefined;
    }

    // calculate suggestedSellingPrice
    if (newBusinessGood.costPrice && grossProfitMarginDesired) {
      newBusinessGood.suggestedSellingPrice = parseFloat(
        (
          newBusinessGood.costPrice *
          (1 + grossProfitMarginDesired / 100)
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
    return handleApiError("Create businessId good failed!", error as string);
  }
};

// // ========================= TESTING =========================
// // calculateIngredientsCostPriceAndAllergies
// // calculateSetMenuCostPriceAndAllergies
// // ===========================================================
// export const POST = async (req: Request) => {
//   try {
//     const ingredientsArr: { supplierGoodId: mongoose.Types.ObjectId, measurementUnit: string, requiredQuantity: number }[] = [
//       {
//         supplierGoodId: new mongoose.Types.ObjectId("667bfac8d28a7ee19d9be443"),
//         measurementUnit: "unit",
//         requiredQuantity: 1,
//       },
//       {
//         supplierGoodId: new mongoose.Types.ObjectId("667bfac8d28a7ee19d9be444"),
//         measurementUnit: "g",
//         requiredQuantity: 0.5,
//       },
//       {
//         supplierGoodId: new mongoose.Types.ObjectId("667bfac8d28a7ee19d9be445"),
//         measurementUnit: "unit",
//         requiredQuantity: 1,
//       },
//       {
//         supplierGoodId: new mongoose.Types.ObjectId("667bfac8d28a7ee19d9be446"),
//         measurementUnit: "g",
//         requiredQuantity: 20,
//       },
//       {
//         supplierGoodId: new mongoose.Types.ObjectId("667bfac8d28a7ee19d9be447"),
//         measurementUnit: "g",
//         requiredQuantity: 10,
//       },
//       {
//         supplierGoodId: new mongoose.Types.ObjectId("667bfac8d28a7ee19d9be44c"),
//         measurementUnit: "g",
//         requiredQuantity: 15,
//       },
//     ];

//     // // cheeseburger - fries
//     // const setMenuArr = ["667bfc0c5d50be40f0c7b065", "667bfddd5d50be40f0c7b079"];

//     await connectDb();

//     const ingredients = await calculateIngredientsCostPriceAndAllergies(
//       ingredientsArr
//     );
//     return new NextResponse(JSON.stringify(ingredients), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });

//     // const setMenuIds = await calculateSetMenuCostPriceAndAllergies(setMenuArr);
//     // return new NextResponse(JSON.stringify(setMenuIds), {
//     //   status: 201,
//     //   headers: { "Content-Type": "application/json" },
//     // });

//   } catch (error) {
//     return handleApiError("Create schedule failed!", error as string);
//   }
// };
