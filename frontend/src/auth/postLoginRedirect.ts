/**
 * Post-login **routing helpers** (`src/auth`) — pure functions for guards and pages.
 *
 * **`safeReturnTo`** — accepts only single-slash same-origin paths. External URLs,
 * protocol-relative URLs, schemes, and auth/recovery destinations are rejected.
 * **`getPostLoginDestination`** — first URL after login/signup/Google or when bouncing an
 * authenticated user off a public-only route. A safe `returnTo` is honoured; otherwise the
 * person stays on the Customer dashboard. Built from **`routes/canonicalPaths.ts`**.
 */
import { canonicalDefaultDashboardPath } from "@/routes/canonicalPaths";

/** Synthetic origin used only to resolve and compare candidate paths without the browser. */
const SYNTHETIC_ORIGIN = "https://imperium.invalid";

/** Destinations that must never be used as a post-auth landing page. */
const AUTH_RECOVERY_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/confirm-email",
  "/confirm-email-change",
  "/request-email-confirmation",
  "/business/register",
  "/business/signup",
]);

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function pathKey(decodedPathname: string): string {
  return decodedPathname.replace(/\/+$/, "").toLowerCase() || "/";
}

/**
 * Return `candidate` when it is a safe internal path, or `null` when it must be rejected.
 *
 * Safe paths begin with exactly one `/`. The helper also rejects protocol-relative URLs,
 * absolute URLs and schemes, backslash-normalised hosts, control characters, and
 * auth/recovery destinations such as `/login?returnTo=…`.
 */
export function safeReturnTo(candidate: unknown): string | null {
  if (typeof candidate !== "string" || candidate.length === 0) return null;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (hasControlCharacters(candidate)) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, SYNTHETIC_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== SYNTHETIC_ORIGIN) return null;
  if (parsed.username || parsed.password) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (!decodedPath.startsWith("/") || decodedPath.startsWith("//")) return null;
  if (hasControlCharacters(decodedPath) || decodedPath.includes("\\")) {
    return null;
  }
  if (AUTH_RECOVERY_PATHS.has(pathKey(decodedPath))) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Read the `returnTo` query parameter from a location search string. */
export function getReturnToParam(search: string): string | null {
  return new URLSearchParams(search).get("returnTo");
}

/** Build a shared auth URL, attaching `returnTo` only when it is safe. */
export function authPathWithReturnTo(
  path: "/login" | "/signup",
  returnTo: string | null | undefined,
): string {
  const safe = safeReturnTo(returnTo);
  return safe ? `${path}?returnTo=${encodeURIComponent(safe)}` : path;
}

/** First URL after authentication: a safe `returnTo`, otherwise the Customer dashboard. */
export function getPostLoginDestination(returnTo?: string | null): string {
  return safeReturnTo(returnTo) ?? canonicalDefaultDashboardPath();
}
