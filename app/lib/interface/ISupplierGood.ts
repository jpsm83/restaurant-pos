import { Types } from "mongoose";

export interface ISupplierGood {
  _id?: Types.ObjectId;
  name: string;
  keyword: string;
  mainCategory: string;
  subCategory?: string;
  currentlyInUse: boolean;
  supplierId: Types.ObjectId;
  businessId?: Types.ObjectId;
  description?: string;
  allergens?: string[];
  budgetImpact?: string;
  imageUrl?: string;
  inventorySchedule?: string;
  minimumQuantityRequired?: number;
  parLevel?: number;
  purchaseUnit?: string;
  measurementUnit?: string;
  quantityInMeasurementUnit?: number;
  totalPurchasePrice?: number;
  pricePerMeasurementUnit?: number;
}
