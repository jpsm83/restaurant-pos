/**
 * AppError — a typed error routes can raise.
 *
 * The global error handler formats every `AppError` as an RFC 9457
 * `application/problem+json` document. Raising an `AppError` (via the factory
 * helpers below) is the only way a route should produce a non-2xx response;
 * routes must not hand-build error bodies.
 */

/** Base namespace for problem-details `type` URIs. */
export const PROBLEM_TYPE_BASE = "https://restaurant-pos.app/errors/";

export type ProblemSlug =
  | "validation"
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "internal";

/** A single field-level error carried in the problem-details `errors[]`. */
export interface ProblemFieldError {
  /** Dotted path to the offending field, e.g. `address.city`. */
  path: string;
  message: string;
}

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
};

const STATUS_SLUGS: Record<number, ProblemSlug> = {
  400: "bad-request",
  401: "unauthorized",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
  500: "internal",
};

/** HTTP reason phrase for a status code. */
export function titleForStatus(status: number): string {
  return STATUS_TITLES[status] ?? (status >= 500 ? "Internal Server Error" : "Error");
}

/** Problem-details `type` slug for a status code. */
export function slugForStatus(status: number): ProblemSlug {
  return STATUS_SLUGS[status] ?? (status >= 500 ? "internal" : "bad-request");
}

export interface AppErrorOptions {
  statusCode?: number;
  /** Override the `type` slug derived from `statusCode`. */
  slug?: ProblemSlug;
  /** Override the HTTP reason phrase derived from `statusCode`. */
  title?: string;
  /** Field-level errors carried in the problem-details `errors[]`. */
  errors?: ProblemFieldError[];
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly type: string;
  readonly title: string;
  readonly errors?: ProblemFieldError[];

  constructor(detail: string, options: AppErrorOptions = {}) {
    super(detail);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 400;
    this.type =
      PROBLEM_TYPE_BASE + (options.slug ?? slugForStatus(this.statusCode));
    this.title = options.title ?? titleForStatus(this.statusCode);
    this.errors = options.errors;
  }
}

export const badRequest = (
  detail: string,
  errors?: ProblemFieldError[],
): AppError => new AppError(detail, { statusCode: 400, errors });

export const unauthorized = (detail = "Unauthorized"): AppError =>
  new AppError(detail, { statusCode: 401 });

export const forbidden = (detail = "Forbidden"): AppError =>
  new AppError(detail, { statusCode: 403 });

export const notFound = (detail = "Not Found"): AppError =>
  new AppError(detail, { statusCode: 404 });

export const conflict = (detail = "Conflict"): AppError =>
  new AppError(detail, { statusCode: 409 });
