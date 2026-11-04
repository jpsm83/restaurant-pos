import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BUSINESS_CONTACT_VERIFICATION_OUTCOMES,
  type BusinessContactVerificationOutcome,
} from "restaurant-pos-packages/interfaces/IBusiness";
import { http } from "../http";
import { multipartFormDataConfig } from "../multipartRequest";
import { queryKeys } from "../queryKeys";
import {
  ServiceRequestError,
  toServiceRequestError,
  type ServiceFailure,
} from "../serviceErrors";
import type {
  BusinessProfileDto,
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

function toBusinessServiceError(
  error: unknown,
  operation: "businessFetch" | "businessUpdate" | "businessContactVerification",
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
      `/api/v1/business/${businessId}/profile`,
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
 * POST `/api/v1/business/:businessId/request-email-verification`.
 * The venue contact address is verified through the account-email rail; the
 * caller maps the machine outcome to localised copy.
 */
export type BusinessContactVerificationSuccess = {
  outcome: BusinessContactVerificationOutcome;
};

function isBusinessContactVerificationOutcome(
  value: unknown,
): value is BusinessContactVerificationOutcome {
  return (
    typeof value === "string" &&
    (BUSINESS_CONTACT_VERIFICATION_OUTCOMES as readonly string[]).includes(
      value,
    )
  );
}

export async function requestBusinessContactVerification(
  businessId: string,
): Promise<BusinessContactVerificationSuccess> {
  let data: { outcome?: unknown };
  try {
    ({ data } = await http.post<{ outcome?: unknown }>(
      `/api/v1/business/${businessId}/request-email-verification`,
      {},
    ));
  } catch (e) {
    throw toBusinessServiceError(e, "businessContactVerification");
  }

  if (!isBusinessContactVerificationOutcome(data.outcome)) {
    throw new BusinessServiceError({
      code: "businessContactVerification.internal",
    });
  }

  return { outcome: data.outcome };
}

/**
 * Multipart `PATCH /api/v1/business/:businessId`.
 * The business is venue data, not a session actor; the response carries no new session.
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

      const result: UpdateBusinessProfileSuccess = {
        message: data.message,
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

/** Requests one venue contact-verification email and refreshes the Owner portfolio. */
export function useRequestBusinessContactVerificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (businessId: string) =>
      requestBusinessContactVerification(businessId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() }),
  });
}
