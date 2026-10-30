import { cuisineTypeEnums, foodSubCategoryEnums } from "restaurant-pos-packages/enums";
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

  const appendIfPresent = (name: string, value: unknown) => {
    const trimmed = asOptionalTrimmedString(value);
    if (trimmed) formData.append(name, trimmed);
  };

  appendIfPresent("tradeName", values.tradeName);
  appendIfPresent("phoneNumber", values.phoneNumber);
  appendIfPresent("currencyTrade", values.currencyTrade);
  appendIfPresent("subscription", values.subscription);

  // Address is mergeable: send only the fields the venue has filled so far.
  const addressEntry = (value: unknown) => asOptionalTrimmedString(value);
  const addressPayload = Object.fromEntries(
    (
      [
        ["country", values.address.country],
        ["state", values.address.state],
        ["city", values.address.city],
        ["street", values.address.street],
        ["buildingNumber", values.address.buildingNumber],
        ["doorNumber", values.address.doorNumber],
        ["complement", values.address.complement],
        ["postCode", values.address.postCode],
        ["region", values.address.region],
      ] as const
    ).flatMap(([key, value]) => {
      const parsed = addressEntry(value);
      return parsed ? [[key, parsed]] : [];
    }),
  );
  if (Object.keys(addressPayload).length > 0) {
    formData.append("address", JSON.stringify(addressPayload));
  }

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
