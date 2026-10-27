/**
 * Safe failure-reporting seam for unexpected server errors.
 *
 * The problem-details handler builds this context from the request and gives
 * it to a reporter. Only the method, route template, status and authenticated
 * identifiers are allowed through — never bodies, headers, cookies, IP
 * addresses, emails or raw query strings.
 */
import type { FastifyRequest } from "fastify";

import type { AuthSession } from "../auth/types.ts";

export interface FailureReportSession {
  type: "user" | "business";
  id: string;
  employeeId?: string;
  businessId?: string;
}

export interface FailureReportContext {
  method: string;
  route: string;
  status: number;
  session?: FailureReportSession;
}

export interface FailureReporter {
  report(error: unknown, context: FailureReportContext): void;
}

function safeSession(
  authSession: AuthSession | undefined,
): FailureReportSession | undefined {
  if (!authSession) return undefined;

  const session: FailureReportSession = {
    type: authSession.type,
    id: authSession.id,
  };

  if (authSession.type === "user") {
    if (authSession.employeeId) session.employeeId = authSession.employeeId;
    if (authSession.businessId) session.businessId = authSession.businessId;
  }

  return session;
}

/** Build a reporter context without leaking request payloads or identity. */
export function buildFailureReportContext(
  request: FastifyRequest,
  status: number,
): FailureReportContext {
  const route =
    request.routeOptions?.url ||
    request.url.split("?")[0] ||
    request.url;
  const session = safeSession(request.authSession);

  return {
    method: request.method,
    route,
    status,
    ...(session ? { session } : {}),
  };
}
