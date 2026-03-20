import { Types } from "mongoose";
import BusinessGood from "src/models/businessGood";
import isObjectIdValid from "src/utils/isObjectIdValid";

export const calculateSetMenuCostPriceAndAllergies = async (
  setMenuIds: Types.ObjectId[] | string[],
) => {
  try {
    if (Array.isArray(setMenuIds) && setMenuIds.length === 0) {
      return "Invalid setMenuIds array!";
    }

    if (!setMenuIds.every((id) => isObjectIdValid([id as string]) === true)) {
      return "Invalid setMenuIds!";
    }

    const businessGoods = await BusinessGood.find({
      _id: { $in: setMenuIds },
    })
      .select("costPrice allergens")
      .lean();

    if (businessGoods.length !== setMenuIds.length) {
      return "Some business goods found!";
    }

    let totalCostPrice = 0;
    const allergensArr: string[] = [];

    businessGoods.forEach((good) => {
      totalCostPrice += good.costPrice;
      if (good.allergens) {
        good.allergens.forEach((allergen: string) => {
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
