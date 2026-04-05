import type { IBusinessMetrics } from "@packages/interfaces/IBusiness.ts";
import { cuisineTypeEnums, foodSubCategoryEnums } from "@packages/enums.ts";
import type {
  BusinessOpeningHourFormValue,
  BusinessProfileDto,
  BusinessProfileFormValues,
  DeliveryOpeningWindowFormValue,
  DeliveryWindowFormValue,
} from "./businessService";

const DEFAULT_BUSINESS_METRICS = {
  foodCostPercentage: 30,
  beverageCostPercentage: 20,
  laborCostPercentage: 30,
  fixedCostPercentage: 20,
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: 9,
    lowBudgetImpact: 7,
    mediumBudgetImpact: 5,
    hightBudgetImpact: 3,
    veryHightBudgetImpact: 1,
  },
} as const;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asFiniteNumberOrFallback(value: unknown, fallback: number): number {
  const parsed = asFiniteNumberOrNull(value);
  return parsed ?? fallback;
}

function canonicalizeAgainstEnum(
  value: string,
  allowed: readonly string[],
): string | null {
  const t = value.trim();
  if (!t) return null;
  const found = allowed.find((a) => a.toLowerCase() === t.toLowerCase());
  return found ?? null;
}

/** Maps API categories to canonical `foodSubCategoryEnums` labels (drops unknown legacy values). */
function normalizeCategories(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const c = canonicalizeAgainstEnum(v, foodSubCategoryEnums);
    if (c) out.push(c);
  }
  return Array.from(new Set(out));
}

/** Normalizes cuisine from string (legacy) or string[] to canonical `cuisineTypeEnums` values. */
function normalizeCuisineTypes(values: unknown): string[] {
  if (Array.isArray(values)) {
    const out: string[] = [];
    for (const v of values) {
      if (typeof v !== "string") continue;
      const c = canonicalizeAgainstEnum(v, cuisineTypeEnums);
      if (c) out.push(c);
    }
    return Array.from(new Set(out));
  }
  if (typeof values === "string" && values.trim()) {
    const c = canonicalizeAgainstEnum(values, cuisineTypeEnums);
    return c ? [c] : [];
  }
  return [];
}

export function normalizeBusinessOpeningHours(
  value: unknown,
): BusinessOpeningHourFormValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const dayOfWeek = Number(row.dayOfWeek);
      const openTime = asTrimmedString(row.openTime);
      const closeTime = asTrimmedString(row.closeTime);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return null;
      }
      if (!openTime || !closeTime) return null;
      return { dayOfWeek, openTime, closeTime };
    })
    .filter((row): row is BusinessOpeningHourFormValue => row !== null);
}

export function normalizeDeliveryOpeningWindows(
  value: unknown,
): DeliveryOpeningWindowFormValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const dayOfWeek = Number(row.dayOfWeek);
      const windows = Array.isArray(row.windows)
        ? row.windows
            .map((w) => {
              const item = w as Record<string, unknown>;
              const openTime = asTrimmedString(item.openTime);
              const closeTime = asTrimmedString(item.closeTime);
              if (!openTime || !closeTime) return null;
              return { openTime, closeTime };
            })
            .filter((w): w is DeliveryWindowFormValue => w !== null)
        : [];
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return null;
      }
      return { dayOfWeek, windows };
    })
    .filter((row): row is DeliveryOpeningWindowFormValue => row !== null);
}

/**
 * Maps API DTO to RHF-friendly model with deterministic defaults and normalized values.
 */
export function businessDtoToFormValues(
  dto: BusinessProfileDto,
): BusinessProfileFormValues {
  const metrics = (dto.metrics ?? {}) as Partial<IBusinessMetrics>;
  const supplierWaste = (metrics.supplierGoodWastePercentage ??
    {}) as Record<string, unknown>;

  return {
    subscription: asTrimmedString(dto.subscription),
    imageUrl: asTrimmedString(dto.imageUrl),
    imageFile: null,
    tradeName: asTrimmedString(dto.tradeName),
    legalName: asTrimmedString(dto.legalName),
    email: asTrimmedString(dto.email),
    confirmEmail: asTrimmedString(dto.email),
    password: "",
    confirmPassword: "",
    phoneNumber: asTrimmedString(dto.phoneNumber),
    taxNumber: asTrimmedString(dto.taxNumber),
    currencyTrade: asTrimmedString(dto.currencyTrade),
    address: {
      country: asTrimmedString(dto.address?.country),
      state: asTrimmedString(dto.address?.state),
      city: asTrimmedString(dto.address?.city),
      street: asTrimmedString(dto.address?.street),
      buildingNumber: asTrimmedString(dto.address?.buildingNumber),
      doorNumber: asTrimmedString(dto.address?.doorNumber),
      complement: asTrimmedString(dto.address?.complement),
      postCode: asTrimmedString(dto.address?.postCode),
      region: asTrimmedString(dto.address?.region),
    },
    contactPerson: asTrimmedString(dto.contactPerson),
    cuisineType: normalizeCuisineTypes(dto.cuisineType),
    categories: normalizeCategories(dto.categories),
    acceptsDelivery: Boolean(dto.acceptsDelivery),
    deliveryRadius: asFiniteNumberOrNull(dto.deliveryRadius),
    minOrder: asFiniteNumberOrNull(dto.minOrder),
    metrics: {
      foodCostPercentage: asFiniteNumberOrFallback(
        metrics.foodCostPercentage,
        DEFAULT_BUSINESS_METRICS.foodCostPercentage,
      ),
      beverageCostPercentage: asFiniteNumberOrFallback(
        metrics.beverageCostPercentage,
        DEFAULT_BUSINESS_METRICS.beverageCostPercentage,
      ),
      laborCostPercentage: asFiniteNumberOrFallback(
        metrics.laborCostPercentage,
        DEFAULT_BUSINESS_METRICS.laborCostPercentage,
      ),
      fixedCostPercentage: asFiniteNumberOrFallback(
        metrics.fixedCostPercentage,
        DEFAULT_BUSINESS_METRICS.fixedCostPercentage,
      ),
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: asFiniteNumberOrFallback(
          supplierWaste.veryLowBudgetImpact,
          DEFAULT_BUSINESS_METRICS.supplierGoodWastePercentage
            .veryLowBudgetImpact,
        ),
        lowBudgetImpact: asFiniteNumberOrFallback(
          supplierWaste.lowBudgetImpact,
          DEFAULT_BUSINESS_METRICS.supplierGoodWastePercentage.lowBudgetImpact,
        ),
        mediumBudgetImpact: asFiniteNumberOrFallback(
          supplierWaste.mediumBudgetImpact,
          DEFAULT_BUSINESS_METRICS.supplierGoodWastePercentage
            .mediumBudgetImpact,
        ),
        hightBudgetImpact: asFiniteNumberOrFallback(
          supplierWaste.hightBudgetImpact,
          DEFAULT_BUSINESS_METRICS.supplierGoodWastePercentage.hightBudgetImpact,
        ),
        veryHightBudgetImpact: asFiniteNumberOrFallback(
          supplierWaste.veryHightBudgetImpact,
          DEFAULT_BUSINESS_METRICS.supplierGoodWastePercentage
            .veryHightBudgetImpact,
        ),
      },
    },
    businessOpeningHours: normalizeBusinessOpeningHours(dto.businessOpeningHours),
    deliveryOpeningWindows: normalizeDeliveryOpeningWindows(
      dto.deliveryOpeningWindows,
    ),
    reportingConfig: {
      weeklyReportStartDay: asFiniteNumberOrNull(
        dto.reportingConfig?.weeklyReportStartDay,
      ),
    },
  };
}
