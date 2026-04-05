/**
 * Absolute links for auth emails. Base URL comes only from env (Phase 0 lock); no request-host guessing.
 * Frontend routes (V1): `/confirm-email`, `/reset-password` (query `token`).
 */

const BASE_ENV_KEYS = [
  "APP_BASE_URL",
  "PUBLIC_APP_URL",
  "FRONTEND_URL",
  "VITE_APP_BASE_URL",
] as const;

export const AUTH_EMAIL_PATH_CONFIRM_EMAIL = "confirm-email";
export const AUTH_EMAIL_PATH_RESET_PASSWORD = "reset-password";

/**
 * Normalize a configured public app URL to a trusted base (origin + optional pathname, no trailing slash).
 * Allows `http:` in development; production callers should set `https:`.
 */
export function normalizeAppBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (!url.hostname) {
    return null;
  }

  let pathname = url.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  if (pathname === "" || pathname === "/") {
    return url.origin;
  }

  return `${url.origin}${pathname}`;
}

/**
 * First valid base from env chain (see `TODO-auth-email-security-flows-implementation.md`).
 */
export function resolveAppBaseUrl(): string {
  for (const key of BASE_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const base = normalizeAppBaseUrl(raw);
    if (base) return base;
  }

  throw new Error(
    "Auth email links: no trusted app base URL. Set APP_BASE_URL (or PUBLIC_APP_URL, FRONTEND_URL, or VITE_APP_BASE_URL on the server).",
  );
}

function buildAuthPageLink(pathSegment: string, rawToken: string): string {
  const token = rawToken.trim();
  if (!token) {
    throw new Error("Token is required");
  }

  const base = resolveAppBaseUrl();
  const baseForResolve = base.endsWith("/") ? base : `${base}/`;
  const query = new URLSearchParams({ token }).toString();
  return new URL(`${pathSegment}?${query}`, baseForResolve).href;
}

export function buildConfirmEmailLink(rawToken: string): string {
  return buildAuthPageLink(AUTH_EMAIL_PATH_CONFIRM_EMAIL, rawToken);
}

export function buildResetPasswordLink(rawToken: string): string {
  return buildAuthPageLink(AUTH_EMAIL_PATH_RESET_PASSWORD, rawToken);
}
