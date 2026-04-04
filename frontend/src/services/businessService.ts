/**
 * Business API — registration + profile fetch/update.
 *
 * ## Flow
 * 1. `createBusiness` -> multipart `POST /api/v1/business`.
 * 2. `getBusinessById` -> `GET /api/v1/business/:businessId`.
 * 3. `updateBusinessProfile` -> multipart `PATCH /api/v1/business/:businessId`.
 *
 * Depends on: `./http`, `./queryKeys`, `@/auth/api` (token side effect only).
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosHeaders, type AxiosRequestConfig } from "axios";
import { setAccessToken } from "@/auth/api";
import type { AuthBusiness, AuthSession } from "@/auth/types";
import type {
  IBusinessMetrics,
  IBusinessProfileAddress,
  IBusinessProfileDto,
} from "@packages/interfaces/IBusiness.ts";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import { ServiceRequestError, toServiceRequestError } from "./serviceErrors";

/**
 * Successful **`POST /api/v1/business`** body (multipart registration).
 * Mirrors `backend/src/routes/v1/business.ts` success payload.
 */
export type CreateBusinessResponseBody = {
  message?: string;
  accessToken?: string;
  user?: AuthSession;
};

/** Result after applying session from a successful registration (Phase 4.1.2). */
export type CreateBusinessSuccess = {
  message?: string;
  accessToken?: string;
  user: AuthBusiness;
};

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
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
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
  cuisineType: string;
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
  accessToken?: string;
  user?: AuthSession;
};

export type UpdateBusinessProfileSuccess = {
  message?: string;
  accessToken?: string;
  user?: AuthBusiness;
};

const DEFAULT_BUSINESS_METRICS: BusinessMetricsFormValue = {
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
};
const inFlightProfileUpdates = new Map<string, Promise<UpdateBusinessProfileSuccess>>();
const DIAGNOSTICS_SCOPE = "services.businessProfile";

/**
 * Generates a client-side operation id for profile saves.
 * Backend can reuse this value for idempotent side-effect dispatching
 * (notifications/email) while keeping profile persistence as the critical path.
 */
function createProfileSaveOperationId(businessId: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `business-profile-save:${businessId}:${uuid}`;
}

function nowMs(): number {
  return Date.now();
}

function logProfileDiagnostics(event: {
  action: "fetch" | "save";
  stage: "success" | "error" | "coalesced";
  businessId: string;
  durationMs?: number;
  status?: number;
  operationId?: string;
  message?: string;
}) {
  const payload = {
    scope: DIAGNOSTICS_SCOPE,
    ...event,
  };
  if (event.stage === "error") {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

export class BusinessServiceError extends ServiceRequestError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = "BusinessServiceError";
  }
}

/**
 * Axios instance defaults set **`Content-Type: application/json`**, which breaks **`FormData`**
 * (boundary must be set by the runtime). Strip it for this request only.
 */
const multipartFormDataConfig: AxiosRequestConfig = {
  transformRequest: [
    (data, headers) => {
      if (headers instanceof AxiosHeaders) {
        headers.delete("Content-Type");
      } else if (headers && typeof headers === "object") {
        delete (headers as Record<string, unknown>)["Content-Type"];
      }
      return data;
    },
  ],
};

function getDefaultBusinessErrorMessage(
  action: "create" | "fetch" | "update",
  status?: number,
): string {
  if (action === "create") return "Business registration failed";
  if (action === "fetch") {
    if (status === 401) return "Please sign in to view the business profile.";
    if (status === 403)
      return "You do not have permission to view this business profile.";
    if (status === 404) return "Business profile was not found.";
    return "Failed to load business profile.";
  }

  if (status === 401) return "Please sign in to save business profile changes.";
  if (status === 403)
    return "You do not have permission to update this business profile.";
  if (status === 404) return "Business profile was not found.";
  if (status === 409)
    return "A business with the same legal name, email, or tax number already exists.";
  return "Failed to update business profile.";
}

function toBusinessServiceError(
  error: unknown,
  action: "create" | "fetch" | "update",
): BusinessServiceError {
  const mapped = toServiceRequestError(error, {
    fallback: getDefaultBusinessErrorMessage(action),
    byStatus:
      action === "fetch"
        ? {
            401: getDefaultBusinessErrorMessage("fetch", 401),
            403: getDefaultBusinessErrorMessage("fetch", 403),
            404: getDefaultBusinessErrorMessage("fetch", 404),
          }
        : action === "update"
          ? {
              401: getDefaultBusinessErrorMessage("update", 401),
              403: getDefaultBusinessErrorMessage("update", 403),
              404: getDefaultBusinessErrorMessage("update", 404),
              409: getDefaultBusinessErrorMessage("update", 409),
            }
          : undefined,
  });
  return new BusinessServiceError(mapped.message, mapped.status);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalTrimmedString(value: unknown): string | undefined {
  const trimmed = asTrimmedString(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function asFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asFiniteNumberOrFallback(value: unknown, fallback: number): number {
  const parsed = asFiniteNumberOrNull(value);
  return parsed ?? fallback;
}

function normalizeCategories(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter(Boolean),
    ),
  );
}

function normalizeBusinessOpeningHours(
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

function normalizeDeliveryOpeningWindows(
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
    cuisineType: asTrimmedString(dto.cuisineType),
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
  }

  const contactPerson = asOptionalTrimmedString(values.contactPerson);
  if (contactPerson) {
    formData.append("contactPerson", contactPerson);
  }

  const cuisineType = asOptionalTrimmedString(values.cuisineType);
  if (cuisineType) {
    formData.append("cuisineType", cuisineType);
  }

  formData.append("categories", JSON.stringify(normalizeCategories(values.categories)));
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

/**
 * Multipart **`POST /api/v1/business`** (`withCredentials` via shared **`http`**).
 * On success: **`setAccessToken`**, return **`user`** for **`AUTH_SUCCESS`** (Phase 4.1.1–4.1.2).
 */
export async function createBusiness(
  formData: FormData,
): Promise<CreateBusinessSuccess> {
  try {
    const { data } = await http.post<CreateBusinessResponseBody>(
      "/api/v1/business",
      formData,
      multipartFormDataConfig,
    );

    if (!data?.user || data.user.type !== "business") {
      throw new Error(data?.message ?? "Business registration failed");
    }

    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }

    return {
      message: data.message,
      accessToken: data.accessToken,
      user: data.user,
    };
  } catch (e) {
    throw toBusinessServiceError(e, "create");
  }
}

export function useCreateBusinessMutation() {
  return useMutation({
    mutationFn: createBusiness,
  });
}

/**
 * Business profile payload for authenticated business editing flow.
 */
export async function getBusinessById(
  businessId: string,
  signal?: AbortSignal,
): Promise<BusinessProfileDto> {
  const startedAtMs = nowMs();
  try {
    const { data } = await http.get<BusinessProfileDto>(
      `/api/v1/business/${businessId}`,
      { signal },
    );
    logProfileDiagnostics({
      action: "fetch",
      stage: "success",
      businessId,
      durationMs: nowMs() - startedAtMs,
    });
    return data;
  } catch (e) {
    const mapped = toBusinessServiceError(e, "fetch");
    logProfileDiagnostics({
      action: "fetch",
      stage: "error",
      businessId,
      durationMs: nowMs() - startedAtMs,
      status: mapped.status,
      message: mapped.message,
    });
    throw mapped;
  }
}

/**
 * Multipart `PATCH /api/v1/business/:businessId`.
 * Keeps auth token in sync when backend returns a fresh session payload.
 */
export function updateBusinessProfile(
  businessId: string,
  formData: FormData,
  options?: { operationId?: string },
): Promise<UpdateBusinessProfileSuccess> {
  const existing = inFlightProfileUpdates.get(businessId);
  if (existing) {
    logProfileDiagnostics({
      action: "save",
      stage: "coalesced",
      businessId,
      operationId: options?.operationId?.trim(),
    });
    return existing;
  }
  const operationId =
    options?.operationId?.trim() || createProfileSaveOperationId(businessId);
  const startedAtMs = nowMs();

  const requestPromise = (async () => {
    try {
      const { data } = await http.patch<UpdateBusinessProfileResponseBody>(
        `/api/v1/business/${businessId}`,
        formData,
        {
          ...multipartFormDataConfig,
          headers: {
            "X-Idempotency-Key": operationId,
            "X-Correlation-Id": operationId,
          },
        },
      );

      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      if (data.user && data.user.type !== "business") {
        throw new BusinessServiceError("Unexpected session type returned by API.");
      }

      const result = {
        message: data.message,
        accessToken: data.accessToken,
        user: data.user?.type === "business" ? data.user : undefined,
      };
      logProfileDiagnostics({
        action: "save",
        stage: "success",
        businessId,
        operationId,
        durationMs: nowMs() - startedAtMs,
      });
      return result;
    } catch (e) {
      const mapped = toBusinessServiceError(e, "update");
      logProfileDiagnostics({
        action: "save",
        stage: "error",
        businessId,
        operationId,
        durationMs: nowMs() - startedAtMs,
        status: mapped.status,
        message: mapped.message,
      });
      throw mapped;
    }
  })();

  inFlightProfileUpdates.set(businessId, requestPromise);
  void requestPromise.finally(() => {
    if (inFlightProfileUpdates.get(businessId) === requestPromise) {
      inFlightProfileUpdates.delete(businessId);
    }
  });
  return requestPromise;
}

export function useBusinessProfileQuery(
  businessId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: businessId
      ? queryKeys.business.detail(businessId)
      : queryKeys.business.detailPending(),
    queryFn: ({ signal }) => getBusinessById(businessId!, signal),
    enabled: Boolean(businessId && enabled),
  });
}

export function useUpdateBusinessProfileMutation() {
  return useMutation({
    mutationFn: ({
      businessId,
      formData,
      operationId,
    }: {
      businessId: string;
      formData: FormData;
      operationId?: string;
    }) => updateBusinessProfile(businessId, formData, { operationId }),
  });
}
