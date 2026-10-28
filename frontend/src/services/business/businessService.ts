/**
 * Business profile service barrel:
 * - shared types used across pages/hooks/tests
 * - focused implementations split into `businessProfileApi`, `businessProfileMapper`, and `businessProfilePayload`
 */
import type {
  IBusinessMetrics,
  IBusinessProfileAddress,
  IBusinessProfileDto,
} from "restaurant-pos-packages/interfaces/IBusiness";

export type BusinessProfileAddress = IBusinessProfileAddress;
export type BusinessProfileDto = IBusinessProfileDto;

export type BusinessOpeningHourFormValue = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
};

export type DeliveryWindowFormValue = {
  openTime: string;
  closeTime: string;
};

export type DeliveryOpeningWindowFormValue = {
  dayOfWeek: number;
  windows: DeliveryWindowFormValue[];
};

export type BusinessMetricsFormValue = {
  foodCostPercentage: number;
  beverageCostPercentage: number;
  laborCostPercentage: number;
  fixedCostPercentage: number;
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: number;
    lowBudgetImpact: number;
    mediumBudgetImpact: number;
    hightBudgetImpact: number;
    veryHightBudgetImpact: number;
  };
};

export type BusinessProfileFormValues = {
  subscription: string;
  imageUrl: string;
  imageFile: File | null;
  tradeName: string;
  legalName: string;
  phoneNumber: string;
  taxNumber: string;
  currencyTrade: string;
  address: {
    country: string;
    state: string;
    city: string;
    street: string;
    buildingNumber: string;
    doorNumber: string;
    complement: string;
    postCode: string;
    region: string;
  };
  contactPerson: string;
  cuisineType: string[];
  categories: string[];
  acceptsDelivery: boolean;
  deliveryRadius: number | null;
  minOrder: number | null;
  metrics: BusinessMetricsFormValue;
  businessOpeningHours: BusinessOpeningHourFormValue[];
  deliveryOpeningWindows: DeliveryOpeningWindowFormValue[];
  reportingConfig: {
    weeklyReportStartDay: number | null;
  };
};

export type UpdateBusinessProfileResponseBody = {
  message?: string;
};

export type UpdateBusinessProfileSuccess = {
  message?: string;
};

export type ManagementContactOption = {
  employeeId: string;
  displayName: string;
};

export type { IBusinessMetrics };

export {
  BusinessServiceError,
  fetchManagementContactOptions,
  getBusinessById,
  updateBusinessProfile,
  useBusinessProfileQuery,
  useUpdateBusinessProfileMutation,
} from "./businessProfileApi";

export { businessDtoToFormValues } from "./businessProfileMapper";
export { formValuesToUpdatePayload } from "./businessProfilePayload";
