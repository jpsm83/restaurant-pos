import { Types } from "mongoose";

// imported utils
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import BusinessGood from "@/app/lib/models/businessGood";

// helper function to set setMenu
export const calculateSetMenuCostPriceAndAllergies = async (
  setMenuIds: Types.ObjectId[]
) => {
  try {
    if (Array.isArray(setMenuIds) && setMenuIds.length === 0) {
      return "Invalid setMenuIds array!";
    }

    // validate setMenu array of ids
    if (!setMenuIds.every((id) => isObjectIdValid([id]) === true)) {
      return "Invalid setMenuIds!";
    }

    // Query all businessGoods at once
    const businessGoods = await BusinessGood.find({
      _id: { $in: setMenuIds },
    })
      .select("costPrice allergens")
      .lean();

    if (businessGoods.length !== setMenuIds.length) {
      return "Some business goods found!";
    }

    // Aggregate costPrice and allergens
    let totalCostPrice = 0;
    const allergensArr: string[] = [];

    businessGoods.forEach((good) => {
      totalCostPrice += good.costPrice;
      if (good.allergens) {
        good.allergens.forEach((allergen: string) => {
          // Add allergen to the map if it's not already present
          if (!allergensArr.includes(allergen)) {
            allergensArr.push(allergen);
          }
        });
      }
    });

    return {
      costPrice: totalCostPrice,
      allergens: allergensArr.length > 0 ? allergensArr : undefined,
    };
  } catch (error) {
    return "SetMenu array calculation and allergens failed! " + error;
  }
};
