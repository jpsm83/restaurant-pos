/**
 * Machine-readable service failures.
 *
 * Services never choose user-facing copy. They derive a stable code from the
 * operation plus the RFC 9457 problem type/status and keep any server text as
 * a diagnostic. UI surfaces resolve the code through `@/i18n/errorCopy`.
 */
import axios from "axios";

export const SERVICE_OPERATIONS = [
  "signIn",
  "signUp",
  "googleAuth",
  "authConfig",
  "confirmEmail",
  "resendConfirmation",
  "emailChange",
  "confirmEmailChange",
  "passwordReset",
  "session",
  "logout",
  "profileFetch",
  "profileUpdate",
  "businessFetch",
  "businessUpdate",
  "businessCreate",
  "companyUpdate",
  "portfolioFetch",
  "modeLoad",
  "modeSave",
  "scheduleLoad",
  "tableConfigLoad",
  "tableConfigSave",
] as const;

export type ServiceOperation = (typeof SERVICE_OPERATIONS)[number];

export const SERVICE_ERROR_OUTCOMES = [
  "validation",
  "badRequest",
  "unauthorized",
  "forbidden",
  "notFound",
  "conflict",
  "internal",
  "transport",
] as const;

export type ServiceErrorOutcome = (typeof SERVICE_ERROR_OUTCOMES)[number];

export type ServiceErrorCode =
  `${ServiceOperation}.${ServiceErrorOutcome}`;

export interface ServiceFieldDiagnostic {
  field?: string;
  message: string;
}

/** The contract every auth `fetch` call and Axios service returns or throws. */
export interface ServiceFailure {
  code: ServiceErrorCode;
  status?: number;
  fieldErrors?: readonly ServiceFieldDiagnostic[];
  /** Diagnostic only. Never render this as primary user copy. */
  serverMessage?: string;
}

export class ServiceRequestError extends Error implements ServiceFailure {
  readonly code: ServiceErrorCode;
  readonly status?: number;
  readonly fieldErrors: readonly ServiceFieldDiagnostic[];
  readonly serverMessage?: string;

  constructor(failure: ServiceFailure, options?: { cause?: unknown }) {
    super(failure.serverMessage ?? failure.code, options);
    this.name = "ServiceRequestError";
    this.code = failure.code;
    this.status = failure.status;
    this.fieldErrors = failure.fieldErrors ?? [];
    this.serverMessage = failure.serverMessage;
  }
}

export function makeServiceErrorCode(
  operation: ServiceOperation,
  outcome: ServiceErrorOutcome,
): ServiceErrorCode {
  return `${operation}.${outcome}`;
}

const PROBLEM_TYPE_OUTCOMES: Record<string, ServiceErrorOutcome> = {
  validation: "validation",
  "bad-request": "badRequest",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  "not-found": "notFound",
  conflict: "conflict",
  internal: "internal",
};

/** Maps problem `type`/status to one documented outcome. */
export function deriveServiceErrorOutcome(input: {
  type?: unknown;
  status?: number;
  hasFieldErrors?: boolean;
}): ServiceErrorOutcome {
  const type = typeof input.type === "string" ? input.type.trim() : "";
  const typeSegment = type.split("/").filter(Boolean).at(-1)?.toLowerCase();
  const fromType = typeSegment
    ? PROBLEM_TYPE_OUTCOMES[typeSegment]
    : undefined;
  if (fromType) return fromType;

  const { status } = input;
  if (status === undefined) return "transport";
  if (status === 422) return "validation";
  if (status === 400) return input.hasFieldErrors ? "validation" : "badRequest";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status >= 500) return "internal";
  if (status >= 400) return "badRequest";
  return "transport";
}

export interface ExtractedProblemDetails {
  type?: string;
  serverMessage?: string;
  fieldErrors: ServiceFieldDiagnostic[];
}

interface ProblemDetailsBody {
  type?: unknown;
  detail?: unknown;
  message?: unknown;
  errors?: unknown;
}

/**
 * Reads the diagnostics the API already sends. `detail`, field messages, and a
 * legacy `{ message }` body stay available to logs/tests; none of them is
 * primary user copy.
 */
export function extractProblemDetails(value: unknown): ExtractedProblemDetails {
  if (typeof value !== "object" || value === null) {
    return { fieldErrors: [] };
  }

  const { type, detail, message, errors } = value as ProblemDetailsBody;
  const fieldErrors: ServiceFieldDiagnostic[] = [];

  if (Array.isArray(errors)) {
    for (const error of errors) {
      if (typeof error !== "object" || error === null) continue;
      const fieldError = error as {
        path?: unknown;
        field?: unknown;
        message?: unknown;
      };
      if (typeof fieldError.message !== "string") continue;
      const text = fieldError.message.trim();
      if (!text) continue;
      const field =
        typeof fieldError.field === "string"
          ? fieldError.field.trim()
          : typeof fieldError.path === "string"
            ? fieldError.path.trim()
            : "";
      fieldErrors.push(field ? { field, message: text } : { message: text });
    }
  }

  const detailText =
    typeof detail === "string" && detail.trim() ? detail.trim() : undefined;
  const legacyText =
    typeof message === "string" && message.trim() ? message.trim() : undefined;
  const joinedFieldMessages = fieldErrors
    .map((fieldError) => fieldError.message)
    .join("; ");

  return {
    type: typeof type === "string" && type.trim() ? type.trim() : undefined,
    serverMessage:
      detailText || joinedFieldMessages || legacyText || undefined,
    fieldErrors,
  };
}

function buildFailure(
  operation: ServiceOperation,
  status: number | undefined,
  body: unknown,
): ServiceRequestError {
  const extracted = extractProblemDetails(body);
  const outcome = deriveServiceErrorOutcome({
    type: extracted.type,
    status,
    hasFieldErrors: extracted.fieldErrors.length > 0,
  });

  return new ServiceRequestError({
    code: makeServiceErrorCode(operation, outcome),
    status,
    fieldErrors: extracted.fieldErrors,
    serverMessage: extracted.serverMessage,
  });
}

/** Maps a response (fetch or Axios) to the machine failure contract. */
export function toServiceRequestErrorFromResponse(
  operation: ServiceOperation,
  status: number,
  body: unknown,
): ServiceRequestError {
  return buildFailure(operation, status, body);
}

/** Maps a client-side/transport error to the contract. */
export function toServiceTransportError(
  operation: ServiceOperation,
  error?: unknown,
): ServiceRequestError {
  const rawMessage =
    typeof error === "object" && error !== null
      ? (error as { message?: unknown }).message
      : undefined;
  const message =
    typeof rawMessage === "string" && rawMessage.trim()
      ? rawMessage.trim()
      : undefined;
  return new ServiceRequestError(
    {
      code: makeServiceErrorCode(operation, "transport"),
      serverMessage: message,
    },
    error instanceof Error ? { cause: error } : undefined,
  );
}

/**
 * Maps an Axios error (or other thrown value) to the contract.
 * Existing machine failures pass through unchanged so nested callers do not
 * lose the original operation context.
 */
export function toServiceRequestError(
  error: unknown,
  operation: ServiceOperation,
): ServiceRequestError {
  if (error instanceof ServiceRequestError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) {
      return toServiceTransportError(operation, error);
    }
    return buildFailure(operation, status, error.response?.data);
  }

  if (error instanceof Error) {
    return toServiceTransportError(operation, error);
  }

  return new ServiceRequestError({
    code: makeServiceErrorCode(operation, "transport"),
  });
}
