import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosHeaders, type AxiosRequestConfig } from "axios";
import { setAccessToken } from "@/auth/api";
import type { AuthBusiness } from "@/auth/types";
import { http } from "../http";
import { queryKeys } from "../queryKeys";
import {
  makeServiceErrorCode,
  ServiceRequestError,
  toServiceRequestError,
  type ServiceFailure,
} from "../serviceErrors";
import type {
  BusinessProfileDto,
  CreateBusinessResponseBody,
  CreateBusinessSuccess,
  ManagementContactOption,
  UpdateBusinessProfileResponseBody,
  UpdateBusinessProfileSuccess,
} from "./businessService";

const inFlightProfileUpdates = new Map<
  string,
  Promise<UpdateBusinessProfileSuccess>
>();
const DIAGNOSTICS_SCOPE = "services.businessProfile";

export class BusinessServiceError extends ServiceRequestError {
  constructor(failure: ServiceFailure, options?: { cause?: unknown }) {
    super(failure, options);
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

function toBusinessServiceError(
  error: unknown,
  operation: "businessCreate" | "businessFetch" | "businessUpdate",
): BusinessServiceError {
  const mapped = toServiceRequestError(error, operation);
  return new BusinessServiceError(mapped, { cause: error });
}

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

/**
 * Multipart **`POST /api/v1/business`** (`withCredentials` via shared **`http`**).
 * On success: **`setAccessToken`**, return **`user`** for **`AUTH_SUCCESS`**.
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
      throw new BusinessServiceError({
        code: makeServiceErrorCode("businessCreate", "internal"),
        serverMessage: data?.message,
      });
    }

    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }

    return {
      message: data.message,
      accessToken: data.accessToken,
      user: data.user as AuthBusiness,
    };
  } catch (e) {
    throw toBusinessServiceError(e, "businessCreate");
  }
}

export function useCreateBusinessMutation() {
  return useMutation({
    mutationFn: createBusiness,
  });
}

export async function fetchManagementContactOptions(
  businessId: string,
  signal?: AbortSignal,
): Promise<ManagementContactOption[]> {
  try {
    const { data } = await http.get<ManagementContactOption[]>(
      `/api/v1/employees/business/${businessId}/management-contacts`,
      { signal },
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw toBusinessServiceError(e, "businessFetch");
  }
}

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
    const mapped = toBusinessServiceError(e, "businessFetch");
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
        throw new BusinessServiceError({
          code: makeServiceErrorCode("businessUpdate", "internal"),
        });
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
      const mapped = toBusinessServiceError(e, "businessUpdate");
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
  void requestPromise
    .catch(() => {
      // Callers handle the rejection; swallow it here so the cleanup chain
      // below does not surface a spurious unhandled rejection.
    })
    .finally(() => {
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
