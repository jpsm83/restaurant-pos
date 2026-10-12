import axios from "axios";

export type ServiceErrorDefaults = {
  fallback: string;
  byStatus?: Partial<Record<number, string>>;
};

export class ServiceRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ServiceRequestError";
    this.status = status;
  }
}

/** A field-level error carried in an RFC 9457 problem-details `errors[]`. */
interface ProblemFieldError {
  message?: string;
}

/** The fields of an RFC 9457 problem-details body this mapper reads. */
interface ProblemDetailsBody {
  detail?: string;
  errors?: ProblemFieldError[];
}

/**
 * Extracts a human-readable message from an RFC 9457 problem-details body,
 * preferring `detail` and falling back to the field-level `errors[]`.
 */
export function extractProblemDetailsMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;

  const { detail, errors } = value as ProblemDetailsBody;
  if (typeof detail === "string" && detail.trim()) return detail.trim();

  if (Array.isArray(errors)) {
    const messages = errors
      .map((error) =>
        typeof error?.message === "string" ? error.message.trim() : "",
      )
      .filter(Boolean);
    if (messages.length > 0) return messages.join("; ");
  }

  return null;
}

export function toServiceRequestError(
  error: unknown,
  defaults: ServiceErrorDefaults,
): ServiceRequestError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const bodyMessage = extractProblemDetailsMessage(error.response?.data);
    const mappedMessage =
      status !== undefined ? defaults.byStatus?.[status] : undefined;

    const message =
      bodyMessage || mappedMessage || defaults.fallback || error.message;
    return new ServiceRequestError(message, status);
  }

  if (error instanceof Error) {
    return new ServiceRequestError(error.message);
  }

  return new ServiceRequestError(defaults.fallback);
}
