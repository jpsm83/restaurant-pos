import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface IsupplierGoodWastePercentage {
  veryLowBudgetImpact: number;
  lowBudgetImpact: number;
  mediumBudgetImpact: number;
  hightBudgetImpact: number;
  veryHightBudgetImpact: number;
}

export interface IMetrics {
  foodCostPercentage: number;
  beverageCostPercentage: number;
  laborCostPercentage: number;
  fixedCostPercentage: number;
  supplierGoodWastePercentage: IsupplierGoodWastePercentage;
}

export interface IBusiness {
  _id?: Types.ObjectId;
  tradeName: string;
  legalName: string;
  imageUrl?: string;
  email: string;
  password: string;
  phoneNumber: string;
  taxNumber: string;
  currencyTrade: string;
  subscription: string;
  address: IAddress;
  metrics?: IMetrics;
  contactPerson?: string;
  cuisineType?: string;
  categories?: string[];
  averageRating?: number;
  ratingCount?: number;
  acceptsDelivery?: boolean;
  deliveryRadius?: number;
  minOrder?: number;
}
