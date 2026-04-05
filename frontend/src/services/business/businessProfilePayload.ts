import { cuisineTypeEnums, foodSubCategoryEnums } from "@packages/enums.ts";
import type { BusinessProfileFormValues } from "./businessService";
import {
  normalizeBusinessOpeningHours,
  normalizeDeliveryOpeningWindows,
} from "./businessProfileMapper";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalTrimmedString(value: unknown): string | undefined {
  const trimmed = asTrimmedString(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function filterToAllowedEnums(
  values: string[],
  allowed: readonly string[],
): string[] {
  const allow = new Set(allowed);
  return Array.from(new Set(values.filter((v) => allow.has(v))));
}

/**
 * Maps form values to backend multipart contract.
 * JSON fields are stringified explicitly to match current backend parsing.
 */
export function formValuesToUpdatePayload(
  values: BusinessProfileFormValues,
): FormData {
  const formData = new FormData();

  formData.append("tradeName", asTrimmedString(values.tradeName));
  formData.append("legalName", asTrimmedString(values.legalName));
  formData.append("email", asTrimmedString(values.email));
  formData.append("phoneNumber", asTrimmedString(values.phoneNumber));
  formData.append("taxNumber", asTrimmedString(values.taxNumber));
  formData.append("currencyTrade", asTrimmedString(values.currencyTrade));
  formData.append("subscription", asTrimmedString(values.subscription));

  const addressPayload: Record<string, unknown> = {
    country: asTrimmedString(values.address.country),
    state: asTrimmedString(values.address.state),
    city: asTrimmedString(values.address.city),
    street: asTrimmedString(values.address.street),
    buildingNumber: asTrimmedString(values.address.buildingNumber),
    postCode: asTrimmedString(values.address.postCode),
  };
  const region = asOptionalTrimmedString(values.address.region);
  if (region) addressPayload.region = region;
  const doorNumber = asOptionalTrimmedString(values.address.doorNumber);
  if (doorNumber) addressPayload.doorNumber = doorNumber;
  const complement = asOptionalTrimmedString(values.address.complement);
  if (complement) addressPayload.complement = complement;
  formData.append("address", JSON.stringify(addressPayload));

  formData.append(
    "metrics",
    JSON.stringify({
      foodCostPercentage: values.metrics.foodCostPercentage,
      beverageCostPercentage: values.metrics.beverageCostPercentage,
      laborCostPercentage: values.metrics.laborCostPercentage,
      fixedCostPercentage: values.metrics.fixedCostPercentage,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact:
          values.metrics.supplierGoodWastePercentage.veryLowBudgetImpact,
        lowBudgetImpact: values.metrics.supplierGoodWastePercentage.lowBudgetImpact,
        mediumBudgetImpact:
          values.metrics.supplierGoodWastePercentage.mediumBudgetImpact,
        hightBudgetImpact:
          values.metrics.supplierGoodWastePercentage.hightBudgetImpact,
        veryHightBudgetImpact:
          values.metrics.supplierGoodWastePercentage.veryHightBudgetImpact,
      },
    }),
  );

  const password = asOptionalTrimmedString(values.password);
  if (password) {
    formData.append("password", password);
    const currentPassword = asOptionalTrimmedString(values.currentPassword);
    if (currentPassword) {
      formData.append("currentPassword", currentPassword);
    }
  }

  formData.append("contactPerson", asTrimmedString(values.contactPerson));

  formData.append(
    "cuisineType",
    JSON.stringify(
      filterToAllowedEnums(values.cuisineType, cuisineTypeEnums),
    ),
  );

  formData.append(
    "categories",
    JSON.stringify(
      filterToAllowedEnums(values.categories, foodSubCategoryEnums),
    ),
  );
  formData.append("acceptsDelivery", String(Boolean(values.acceptsDelivery)));

  if (values.deliveryRadius !== null && Number.isFinite(values.deliveryRadius)) {
    formData.append("deliveryRadius", String(values.deliveryRadius));
  }
  if (values.minOrder !== null && Number.isFinite(values.minOrder)) {
    formData.append("minOrder", String(values.minOrder));
  }

  formData.append(
    "businessOpeningHours",
    JSON.stringify(normalizeBusinessOpeningHours(values.businessOpeningHours)),
  );
  formData.append(
    "deliveryOpeningWindows",
    JSON.stringify(normalizeDeliveryOpeningWindows(values.deliveryOpeningWindows)),
  );

  if (
    values.reportingConfig.weeklyReportStartDay !== null &&
    Number.isFinite(values.reportingConfig.weeklyReportStartDay)
  ) {
    formData.append(
      "reportingConfig",
      JSON.stringify({
        weeklyReportStartDay: values.reportingConfig.weeklyReportStartDay,
      }),
    );
  }

  if (values.imageFile && values.imageFile.size > 0) {
    formData.append("imageUrl", values.imageFile, values.imageFile.name);
  }

  return formData;
}
