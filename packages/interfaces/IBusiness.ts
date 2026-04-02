import { Types } from "mongoose";
import type { IAddress } from "./IAddress";

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

export interface IBusinessOpeningHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface IDeliveryOpeningWindow {
  dayOfWeek: number;
  windows: {
    openTime: string;
    closeTime: string;
  }[];
}

export interface IReportingConfig {
  /**
   * Start day of the business reporting week.
   * 0 = Sunday, 1 = Monday, ... 6 = Saturday.
   * Used by weeklyBusinessReport to group dailySalesReports.
   */
  weeklyReportStartDay: number;
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
  businessOpeningHours?: IBusinessOpeningHour[];
  deliveryOpeningWindows?: IDeliveryOpeningWindow[];
  reportingConfig?: IReportingConfig;
}

/**
 * API-safe business profile payload shared across backend and frontend.
 * Mirrors GET `/api/v1/business/:businessId` response shape (`password` excluded).
 */
export interface IBusinessProfileDto
  extends Omit<IBusiness, "_id" | "password" | "reportingConfig"> {
  _id: string;
  reportingConfig?: Partial<IReportingConfig>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Shared aliases for clearer frontend/backend type imports.
 */
export type IBusinessProfileAddress = IAddress;
export type IBusinessMetrics = IMetrics;
