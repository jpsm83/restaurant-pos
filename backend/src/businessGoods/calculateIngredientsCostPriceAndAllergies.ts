import convert, { Unit } from "convert-units";
import { Types } from "mongoose";
import type { IIngredient } from "../../../lib/interface/IBusinessGood.ts";
import type { ISupplierGood } from "../../../lib/interface/ISupplierGood.ts";
import SupplierGood from "../models/supplierGood.ts";
import objDefaultValidation from "../../../lib/utils/objDefaultValidation.ts";

const reqIngredientsFields = [
  "supplierGoodId",
  "measurementUnit",
  "requiredQuantity",
];

const nonReqIngredientsFields = ["costOfRequiredQuantity"];

const calculateIngredientsCostPriceAndAllergies = async (
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

export default calculateIngredientsCostPriceAndAllergies;