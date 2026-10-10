/**
 * RFC 9457 problem-details envelope.
 *
 * One formatter turns every error — thrown `AppError`, zod provider validation
 * failure, or unexpected exception — into a single `application/problem+json`
 * document. The global handler registered here is the only place an error body
 * is produced.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "@fastify/type-provider-zod";

import {
  AppError,
  PROBLEM_TYPE_BASE,
  slugForStatus,
  titleForStatus,
  type ProblemFieldError,
} from "./appError.ts";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ProblemFieldError[];
}

/** Shape of the error Fastify builds from a provider validation result. */
interface ValidationErrorLike extends Error {
  statusCode?: number;
  validation?: Array<{ instancePath?: string; message?: string }>;
  validationContext?: string;
}

const CONTEXT_LABELS: Record<string, string> = {
  body: "body",
  params: "path parameters",
  querystring: "query",
  headers: "headers",
};

/** `/address/city` -> `address.city`. */
function toDottedPath(instancePath?: string): string {
  if (!instancePath) return "";
  return instancePath.replace(/^\//, "").replace(/\//g, ".");
}

/** Convert any thrown value into an RFC 9457 problem-details document. */
export function toProblemDetails(err: unknown, instance: string): ProblemDetails {
  if (hasZodFastifySchemaValidationErrors(err)) {
    const validationErr = err as ValidationErrorLike;
    const label = CONTEXT_LABELS[validationErr.validationContext ?? ""] ?? "request";
    return {
      type: `${PROBLEM_TYPE_BASE}validation`,
      title: titleForStatus(400),
      status: 400,
      detail: `Request ${label} is invalid`,
      instance,
      errors: (validationErr.validation ?? []).map((issue) => ({
        path: toDottedPath(issue.instancePath),
        message: issue.message ?? "Invalid value",
      })),
    };
  }

  if (err instanceof AppError) {
    const problem: ProblemDetails = {
      type: err.type,
      title: err.title,
      status: err.statusCode,
      detail: err.message,
      instance,
    };
    if (err.errors && err.errors.length > 0) {
      problem.errors = err.errors;
    }
    return problem;
  }

  const fallback = err as { statusCode?: unknown; message?: unknown } | null;
  const status =
    fallback && typeof fallback.statusCode === "number"
      ? fallback.statusCode
      : 500;
  // Never leak internal error messages on server errors; log them instead.
  const detail =
    status >= 500
      ? titleForStatus(status)
      : fallback &&
          typeof fallback.message === "string" &&
          fallback.message.length > 0
        ? fallback.message
        : titleForStatus(status);

  return {
    type: `${PROBLEM_TYPE_BASE}${slugForStatus(status)}`,
    title: titleForStatus(status),
    status,
    detail,
    instance,
  };
}

/** Register the global error handler that emits problem-details documents. */
export function registerProblemDetailsHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (err: unknown, req: FastifyRequest, reply: FastifyReply) => {
      const problem = toProblemDetails(err, req.url);
      if (problem.status >= 500) {
        req.log.error(err);
      }
      reply
        .status(problem.status)
        .type("application/problem+json")
        .send(problem);
    },
  );
}
