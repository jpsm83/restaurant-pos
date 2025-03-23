import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import { calculateIngredientsCostPriceAndAllergies } from "../utils/calculateIngredientsCostPriceAndAllergies";
import { calculateSetMenuCostPriceAndAllergies } from "../utils/calculateSetMenuCostPriceAndAllergies";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import deleteFolderCloudinary from "@/lib/cloudinary/deleteFolderCloudinary";

// imported interfaces
import { IBusinessGood } from "@/lib/interface/IBusinessGood";

// imported models
import BusinessGood from "@/lib/db/models/businessGood";
import Promotion from "@/lib/db/models/promotion";
import Order from "@/lib/db/models/order";
import SupplierGood from "@/lib/db/models/supplierGood";

// imported enums
import {
  mainCategoriesEnums,
  allergensEnums,
  measurementUnitEnums,
} from "@/lib/enums";

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
    return handleApiError(
      "Get business good by its id failed!",
      error as string
    );
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
    const { businessGoodId } = context.params;

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
      ? JSON.parse(formData.get("ingredients") as string)
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

    // check if the business good exists
    const businessGood = (await BusinessGood.findById(
      businessGoodId
    ).lean()) as IBusinessGood | null;

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

    // required fields
    if (name !== businessGood?.name) updatedBusinessGoodObj.name = name;
    if (keyword !== businessGood?.keyword)
      updatedBusinessGoodObj.keyword = keyword;
    if (mainCategory !== businessGood?.mainCategory)
      updatedBusinessGoodObj.mainCategory = mainCategory;
    if (onMenu !== businessGood?.onMenu) updatedBusinessGoodObj.onMenu = onMenu;
    if (available !== businessGood?.available)
      updatedBusinessGoodObj.available = available;
    if (sellingPrice !== businessGood?.sellingPrice)
      updatedBusinessGoodObj.sellingPrice = sellingPrice;

    // non-required fields
    if (subCategory && subCategory !== businessGood?.subCategory)
      updatedBusinessGoodObj.subCategory = subCategory;
    if (
      grossProfitMarginDesired &&
      grossProfitMarginDesired !== businessGood?.grossProfitMarginDesired
    )
      updatedBusinessGoodObj.grossProfitMarginDesired =
        grossProfitMarginDesired;
    if (description && description !== businessGood?.description)
      updatedBusinessGoodObj.description = description;
    if (allergens && allergens !== businessGood?.allergens)
      updatedBusinessGoodObj.allergens = allergens;
    if (deliveryTime && deliveryTime !== businessGood?.deliveryTime)
      updatedBusinessGoodObj.deliveryTime = deliveryTime;

    // upload image if it exists
    if (files && files.length > 0) {
      const folder = `/business/${businessGood?.businessId}/businessGoods/${businessGoodId}`;

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

      updatedBusinessGoodObj.imagesUrl = [
        ...(businessGood?.imagesUrl || []),
        ...cloudinaryUploadResponse,
      ];
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
      updatedBusinessGoodObj.ingredients =
        calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
          return {
            supplierGoodId: ing.supplierGoodId,
            measurementUnit: ing.measurementUnit,
            requiredQuantity: ing.requiredQuantity ?? 0,
            costOfRequiredQuantity: ing.costOfRequiredQuantity,
          };
        });

      // if there is ingredients, setMenuIds should be undefined
      updatedBusinessGoodObj.setMenuIds = [];

      // calculate the cost price of all ingredients
      updatedBusinessGoodObj.costPrice = parseFloat(
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

      updatedBusinessGoodObj.allergens =
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
      updatedBusinessGoodObj.ingredients = [];

      // add the setMenuIds array to the new businessId good
      updatedBusinessGoodObj.setMenuIds = setMenuIds;

      // calculate the sum of all cost prices
      updatedBusinessGoodObj.costPrice = parseFloat(
        calculateSetMenuCostPriceAndAllergiesResult.costPrice.toFixed(2)
      );

      // add the allergens to the new businessId good
      updatedBusinessGoodObj.allergens =
        calculateSetMenuCostPriceAndAllergiesResult.allergens &&
        calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
          ? calculateSetMenuCostPriceAndAllergiesResult.allergens
          : undefined;
    }

    // calculate suggestedSellingPrice
    if (updatedBusinessGoodObj.costPrice && grossProfitMarginDesired) {
      updatedBusinessGoodObj.suggestedSellingPrice = parseFloat(
        (
          updatedBusinessGoodObj.costPrice *
          (1 + grossProfitMarginDesired / 100)
        ).toFixed(2)
      );
    }
    console.log(updatedBusinessGoodObj);
    // update the business good
    const updateBusinessGood = await BusinessGood.findByIdAndUpdate(
      { _id: businessGoodId },
      { $set: updatedBusinessGoodObj },
      { new: true, lean: true }
    );

    // If business not found after update
    if (!updateBusinessGood) {
      return new NextResponse(
        JSON.stringify({ message: "Business good to update not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

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
    return handleApiError("Update business good failed!", error as string);
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
  const { businessGoodId } = context.params;

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

    if (businessGoodInOrders || businessGoodInSetMenu) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: businessGoodInOrders
            ? "Cannot delete Business good because it is in some open orders!"
            : "Cannot delete Business good because it is in some set menu!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const [DeletedBusinessGood] = await Promise.all([
      // delete the business good
      // findOneAndDelete returns the deleted document
      BusinessGood.findOneAndDelete({ _id: businessGoodId }, { session }),
      // delete the business good id reference from promotions
      Promotion.updateMany(
        { businessGoodsToApplyIds: businessGoodId },
        { $pull: { businessGoodsToApplyIds: businessGoodId } },
        { session }
      ),
    ]);

    if (!DeletedBusinessGood) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    // cloudinary folder path
    const folderPath = `/business/${DeletedBusinessGood?.businessId}/businessGoods/${businessGoodId}`;

    // Delete business folder in cloudinary
    const deleteFolderCloudinaryResult: string | boolean =
      await deleteFolderCloudinary(folderPath);

    if (deleteFolderCloudinaryResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: deleteFolderCloudinaryResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Business good ${businessGoodId} deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete business good failed!", error as string);
  } finally {
    session.endSession();
  }
};
