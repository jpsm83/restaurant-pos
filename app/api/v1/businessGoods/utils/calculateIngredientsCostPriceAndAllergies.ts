import convert, { Unit } from "convert-units";

// imported interfaces
import { ISupplierGood } from "@/lib/interface/ISupplierGood";
import { IIngredient } from "@/lib/interface/IBusinessGood";

// imported models
import SupplierGood from "@/lib/db/models/supplierGood";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";
import { Types } from "mongoose";

const reqIngredientsFields = [
  "supplierGoodId",
  "measurementUnit",
  "requiredQuantity",
];

const nonReqIngredientsFields = ["costOfRequiredQuantity"];

// this function calculates the cost price of the ingredients
// and checks if the ingredients have allergens
// it returns an array of objects with the following fields:
// supplierGoodId, measurementUnit, requiredQuantity, costOfRequiredQuantity, allergens
export const calculateIngredientsCostPriceAndAllergies = async (
  ingredients: IIngredient[]
) => {
  try {
    const newIngredientsArray: {
      supplierGoodId: Types.ObjectId;
      measurementUnit: string;
      requiredQuantity: number;
      costOfRequiredQuantity: number;
      allergens: string[] | undefined;
    }[] = [];

    for (const ingredient of ingredients) {
      // validate address
      const ingredientValidationResult = objDefaultValidation(
        ingredient,
        reqIngredientsFields,
        nonReqIngredientsFields
      );

      if (ingredientValidationResult !== true) {
        return ingredientValidationResult;
      }

      const supplierGood = (await SupplierGood.findOne({
        _id: ingredient.supplierGoodId,
      })
        .select("measurementUnit pricePerMeasurementUnit allergens")
        .lean()) as ISupplierGood | null;

      if (!supplierGood) {
        return "Supplier good not found!";
      }

      const ingredientObj = {
        supplierGoodId: ingredient.supplierGoodId,
        measurementUnit: ingredient.measurementUnit,
        requiredQuantity: ingredient.requiredQuantity,
        costOfRequiredQuantity: 0,
        allergens: supplierGood?.allergens || undefined,
      };

      if (ingredient.measurementUnit && ingredient.requiredQuantity) {
        if (supplierGood?.measurementUnit === ingredient.measurementUnit) {
          if (ingredient.measurementUnit === ("unit" as string)) {
            ingredientObj.costOfRequiredQuantity =
              ingredient.requiredQuantity *
              (supplierGood?.pricePerMeasurementUnit ?? 0);
          } else {
            ingredientObj.costOfRequiredQuantity =
              (supplierGood.pricePerMeasurementUnit ?? 0) *
              ingredient.requiredQuantity;
          }
        } else {
          const convertedQuantity = convert(ingredient.requiredQuantity)
            .from(ingredient.measurementUnit as Unit)
            .to(supplierGood?.measurementUnit as Unit);
          ingredientObj.costOfRequiredQuantity =
            (supplierGood?.pricePerMeasurementUnit ?? 0) * convertedQuantity;
        }
      }
      newIngredientsArray.push(ingredientObj);
    }

    return newIngredientsArray;
  } catch (error) {
    return "Ingredients array calculation and allergens failed! " + error;
  }
};
