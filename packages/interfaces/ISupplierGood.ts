import { Types } from "mongoose";

export interface ISupplierGood {
  _id?: Types.ObjectId;
  name: string;
  keyword: string;
  mainCategory: string;
  supplierId: Types.ObjectId | string;
  businessId: Types.ObjectId | string;
  
  currentlyInUse?: boolean;
  subCategory?: string;
  description?: string;
  allergens?: string[];
  budgetImpact?: string;
  imagesUrl?: string[];
  inventorySchedule?: string;
  minimumQuantityRequired?: number;
  parLevel?: number;
  purchaseUnit?: string;
  measurementUnit?: string;
  quantityInMeasurementUnit?: number;
  totalPurchasePrice?: number;
  pricePerMeasurementUnit?: number;
}
