import { cuisineTypeEnums, foodSubCategoryEnums } from "restaurant-pos-packages/enums";
import {
  canEditBusinessProfileField,
  type AccessLayer,
  type BusinessProfileField,
} from "restaurant-pos-packages/access";
import type { BusinessProfileFormValues } from "./businessService";
import {
  normalizeBusinessOpeningHours,
  normalizeDeliveryOpeningWindows,
} from "./businessProfileMapper";

type UpdatePayloadOptions = {
  /**
   * The caller's effective layer. When provided, fields above that layer are
   * omitted so the server's whole-request field authorization never refuses a
   * save; when absent every field is included (unit-test and legacy callers).
   */
  actorLayer?: AccessLayer;
};

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
  options: UpdatePayloadOptions = {},
): FormData {
  const formData = new FormData();
  const canEdit = (field: BusinessProfileField) =>
    options.actorLayer === undefined ||
    canEditBusinessProfileField(options.actorLayer, field);

  const appendIfPresent = (name: BusinessProfileField, value: unknown) => {
    if (!canEdit(name)) return;
    const trimmed = asOptionalTrimmedString(value);
    if (trimmed) formData.append(name, trimmed);
  };

  appendIfPresent("tradeName", values.tradeName);
  appendIfPresent("email", values.email);
  appendIfPresent("phoneNumber", values.phoneNumber);
  appendIfPresent("currencyTrade", values.currencyTrade);

  if (canEdit("address")) {
    // Address is mergeable: send only the fields the venue has filled so far.
    const addressPayload: Record<string, string> = {};
    const addressValues = {
      country: values.address.country,
      state: values.address.state,
      city: values.address.city,
      street: values.address.street,
      buildingNumber: values.address.buildingNumber,
      doorNumber: values.address.doorNumber,
      complement: values.address.complement,
      postCode: values.address.postCode,
      region: values.address.region,
    };
    for (const [key, value] of Object.entries(addressValues)) {
      const parsed = asOptionalTrimmedString(value);
      if (parsed) addressPayload[key] = parsed;
    }
    if (Object.keys(addressPayload).length > 0) {
      formData.append("address", JSON.stringify(addressPayload));
    }
  }

  if (canEdit("metrics")) {
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
  }

  if (canEdit("contactPerson")) {
    formData.append("contactPerson", asTrimmedString(values.contactPerson));
  }

  if (canEdit("cuisineType")) {
    formData.append(
      "cuisineType",
      JSON.stringify(
        filterToAllowedEnums(values.cuisineType, cuisineTypeEnums),
      ),
    );
  }

  if (canEdit("categories")) {
    formData.append(
      "categories",
      JSON.stringify(
        filterToAllowedEnums(values.categories, foodSubCategoryEnums),
      ),
    );
  }

  if (canEdit("acceptsDelivery")) {
    formData.append("acceptsDelivery", String(Boolean(values.acceptsDelivery)));
  }

  if (
    canEdit("deliveryRadius") &&
    values.deliveryRadius !== null &&
    Number.isFinite(values.deliveryRadius)
  ) {
    formData.append("deliveryRadius", String(values.deliveryRadius));
  }
  if (
    canEdit("minOrder") &&
    values.minOrder !== null &&
    Number.isFinite(values.minOrder)
  ) {
    formData.append("minOrder", String(values.minOrder));
  }

  if (canEdit("businessOpeningHours")) {
    formData.append(
      "businessOpeningHours",
      JSON.stringify(normalizeBusinessOpeningHours(values.businessOpeningHours)),
    );
  }
  if (canEdit("deliveryOpeningWindows")) {
    formData.append(
      "deliveryOpeningWindows",
      JSON.stringify(normalizeDeliveryOpeningWindows(values.deliveryOpeningWindows)),
    );
  }

  if (
    canEdit("reportingConfig") &&
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

  if (
    canEdit("imageUrl") &&
    values.imageFile &&
    values.imageFile.size > 0
  ) {
    formData.append("imageUrl", values.imageFile, values.imageFile.name);
  }

  return formData;
}
