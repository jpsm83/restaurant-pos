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

function getMessageFromUnknown(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function toServiceRequestError(
  error: unknown,
  defaults: ServiceErrorDefaults,
): ServiceRequestError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const bodyMessage = getMessageFromUnknown(error.response?.data);
    const mappedMessage =
      status !== undefined ? defaults.byStatus?.[status] : undefined;

    const message =
      bodyMessage?.trim() || mappedMessage || defaults.fallback || error.message;
    return new ServiceRequestError(message, status);
  }

  if (error instanceof Error) {
    return new ServiceRequestError(error.message);
  }

  return new ServiceRequestError(defaults.fallback);
}
