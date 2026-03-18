import { Types } from "mongoose";

export interface IIngredient {
  supplierGoodId: Types.ObjectId;
  measurementUnit: string; // convert.Unit
  requiredQuantity: number;
  costOfRequiredQuantity?: number;
}

export interface IBusinessGood {
  _id?: Types.ObjectId | string;
  name: string;
  keyword: string;
  mainCategory: string;
  subCategory?: string;
  onMenu: boolean;
  available: boolean;
  sellingPrice: number;
  businessId: Types.ObjectId | string;
  ingredients?: IIngredient[];
  setMenuIds?: Types.ObjectId[] | string[];
  costPrice?: number;
  grossProfitMarginDesired?: number;
  suggestedSellingPrice?: number;
  description?: string;
  allergens?: string[];
  imagesUrl?: string[];
  deliveryTime?: number;
}
