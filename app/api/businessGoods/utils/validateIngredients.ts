// imported interfaces
import { IIngredients } from "@/app/lib/interface/IBusinessGood";

export const validateIngredients = (ingredientsArray: IIngredients[]) => {
  // check if the ingredientsArray is an array
  if (!Array.isArray(ingredientsArray) || !ingredientsArray.length) {
    return "Invalid ingredients array";
  }

  const requiredValidKeys = [
    "supplierGoodId",
    "measurementUnit",
    "requiredQuantity",
  ];

  for (const ingredient of ingredientsArray) {
    // Check for the presence of all required keys
    for (const key of requiredValidKeys) {
      if (!ingredient[key as keyof IIngredients]) {
        return `Validation fail, ${key} must have a value!`;
      }
    }
  }

  // All validations passed
  return true;
};
