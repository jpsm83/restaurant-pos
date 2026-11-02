/**
 * Deny-by-default authorization for `/api/v1`.
 *
 * Every route under the v1 root requires a live User session unless it appears
 * in `PUBLIC_ROUTE_ALLOWLIST`. The allowlist carries one reason per route and
 * is the only place a public surface may be declared. The gate is registered
 * once at the v1 route root; routes do not add a second ad-hoc authentication
 * check for the default decision.
 */

import type {
  FastifyInstance,
  preValidationHookHandler,
} from "fastify";

import { authenticateLiveRequest } from "./middleware.ts";

export type PublicRouteMethod = "GET" | "POST" | "OPTIONS";

export interface PublicRoute {
  method: PublicRouteMethod;
  /** Fastify route pattern including the `/api/v1` prefix (or `/health`). */
  url: string;
  /** Why this route is reachable without a live User session. */
  reason: string;
}

/**
 * The one public allowlist. `HEAD` follows its allowlisted `GET` route.
 *
 * Keep this list closed: adding an entry is a security review decision, not a
 * convenience. Business-layer rules still apply to tenant reads and writes on
 * authenticated routes.
 */
export const PUBLIC_ROUTE_ALLOWLIST: readonly PublicRoute[] = [
  {
    method: "GET",
    url: "/health",
    reason: "Liveness probe used by the platform; returns no tenant data.",
  },
  {
    method: "GET",
    url: "/api/v1/auth/config",
    reason:
      "Client bootstrapping needs to know whether Google sign-in is available before a session exists.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/signup",
    reason: "Account creation is the entry point for a new User.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/login",
    reason: "Email/password sign-in issues the first session.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/google",
    reason: "Google sign-in issues the first session.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/refresh",
    reason:
      "Exchanges the refresh cookie for a new access token; the cookie is the credential.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/logout",
    reason:
      "Revokes the refresh cookie; a missing or expired cookie still clears the browser state.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/request-email-confirmation",
    reason:
      "Anti-enumeration recovery request for a person who is not signed in.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/request-password-reset",
    reason:
      "Anti-enumeration recovery request for a person who is not signed in.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/reset-password",
    reason: "Consumes a one-time password-reset token without a session.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/confirm-email",
    reason: "Consumes a one-time email-confirmation token without a session.",
  },
  {
    method: "POST",
    url: "/api/v1/auth/confirm-email-change",
    reason:
      "Consumes a one-time sign-in email-change token without a session.",
  },
  {
    method: "GET",
    url: "/api/v1/business",
    reason:
      "Public venue discovery: lists the published discovery fields of live venues.",
  },
  {
    method: "GET",
    url: "/api/v1/business/:businessId",
    reason:
      "Public venue profile read: returns the published discovery fields of one venue.",
  },
  {
    method: "GET",
    url: "/api/v1/notifications/live",
    reason:
      "WebSocket live-upgrade boundary authenticates with a one-time live ticket on the URL, not the ordinary route hook.",
  },
  {
    method: "OPTIONS",
    url: "*",
    reason:
      "CORS preflight requests carry no credentials and are answered by the CORS plugin.",
  },
] as const;

/**
 * Normalize auto-added `HEAD` requests onto their allowlisted `GET` route and
 * fold Fastify's trailing-slash variant onto the same pattern.
 */
export function authorizationRouteKey(method: string, url: string): string {
  const normalizedMethod = method === "HEAD" ? "GET" : method;
  const normalizedUrl =
    url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
  return `${normalizedMethod} ${normalizedUrl}`;
}

const publicKeys = new Set(
  PUBLIC_ROUTE_ALLOWLIST.map((route) =>
    authorizationRouteKey(route.method, route.url),
  ),
);

/** True when the route is deliberately public. */
export function isPublicRoute(method: string, url: string): boolean {
  return publicKeys.has(authorizationRouteKey(method, url));
}

/**
 * The single v1 authorization gate. Register it once on the `/api/v1` route
 * root; it runs before every child route's own validation and handlers.
 */
export function createAuthorizationGate(
  app: FastifyInstance,
): preValidationHookHandler {
  return async (req) => {
    if (isPublicRoute(req.method, req.routeOptions.url ?? "")) {
      return;
    }
    await authenticateLiveRequest(app, req);
  };
}
