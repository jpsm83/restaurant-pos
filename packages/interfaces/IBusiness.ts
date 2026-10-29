import type { Types } from "mongoose";
import type { IAddress } from "./IAddress.ts";

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
  /** Legacy venue legal name; tax identity now lives on the owning Company. */
  legalName?: string;
  imageUrl?: string;
  /** Venue contact email; never a sign-in credential. */
  email?: string;
  /** Whether the venue contact email has been verified. */
  emailVerified?: boolean;
  phoneNumber?: string;
  /** Legacy venue tax number; tax identity now lives on the owning Company. */
  taxNumber?: string;
  currencyTrade: string;
  /** Owning Company; the path from this Business to its Owner. */
  companyId?: Types.ObjectId;
  subscription: string;
  /**
   * Authoritative IANA timezone for the business (e.g. `America/Bogota`).
   * `undefined` on legacy businesses; reads resolve a missing value to UTC.
   */
  timezone?: string;
  /** Full postal address; a draft may store only its onboarding country. */
  address?: Partial<IAddress>;
  metrics?: IMetrics;
  /** Optional primary contact: employee id (hex) chosen from management staff, or legacy free text. */
  contactPerson?: string;
  /** Discovery cuisines; persisted as string array (legacy single string normalized on read). */
  cuisineType?: string[];
  /** Discovery food subcategories; labels from `foodSubCategoryEnums`. */
  categories?: string[];
  averageRating?: number;
  ratingCount?: number;
  acceptsDelivery?: boolean;
  deliveryRadius?: number;
  minOrder?: number;
  businessOpeningHours?: IBusinessOpeningHour[];
  deliveryOpeningWindows?: IDeliveryOpeningWindow[];
  reportingConfig?: IReportingConfig;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

/**
 * API-safe business profile payload shared across backend and frontend.
 * Mirrors GET `/api/v1/business/:businessId` response shape.
 */
export interface IBusinessProfileDto
  extends Omit<IBusiness, "_id" | "reportingConfig"> {
  _id: string;
  reportingConfig?: Partial<IReportingConfig>;
  /** True when no valid zone is stored and the response fell back to `UTC`. */
  timezoneIsDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Shared aliases for clearer frontend/backend type imports.
 */
export type IBusinessProfileAddress = IAddress;
export type IBusinessMetrics = IMetrics;
