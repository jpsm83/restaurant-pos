import { Types } from "mongoose";

export interface IIngredients {
  supplierGoodId: Types.ObjectId;
  measurementUnit: convert.Unit;
  requiredQuantity: number;
  costOfRequiredQuantity?: number;
}

export interface IBusinessGood {
  name: string;
  keyword: string;
  mainCategory: string;
  subCategory?: string;
  onMenu: boolean;
  available: boolean;
  sellingPrice: number;
  businessId?: Types.ObjectId;
  ingredients?: IIngredients[];
  setMenuIds?: Types.ObjectId[];
  costPrice?: number;
  grossProfitMarginDesired?: number;
  suggestedSellingPrice?: number;
  description?: string;
  allergens?: string[];
  imageUrl?: string;
  deliveryTime?: number;
}
