/**
 * Canonical URLs & path matching for the app shell (`src/routes` — see `AuthRouteGuards.tsx`).
 *
 * ## Role
 * Pure functions only (no React). Every programmatic navigation or link that must stay in sync
 * with the route tree should derive paths from here so strings are not duplicated in pages.
 *
 * ## Who imports this
 * - `AuthRouteGuards.tsx` — redirects when `:userId` / `:businessId` do not match the session.
 * - `auth/postLoginRedirect.ts` — first URL after login / signup (`getPostLoginDestination`).
 * - `components/AccountMenuPopover.tsx` — account menu targets (home / profile / favorites).
 * - `pages/SelectUserModePage.tsx` — navigate to customer or employee **home** after mode selection.
 *
 * ## How it wires to the router
 * `appRoutes.tsx` declares concrete `<Route path="…">` segments (`home`, `profile`, …). Those
 * paths must match what the `canonical*` helpers build (e.g. tenant landing is
 * `/business/:id/home`, not the bare `/business/:id`). If you add a new shell segment, add a
 * helper here and use it in guards + post-login + any feature navigation.
 *
 * ## Flow (typical)
 * 1. User signs in → `getPostLoginDestination` uses `canonicalBusinessHomePath` /
 *    `canonicalUserCustomerHomePath` / `canonicalUserModePath` depending on session shape.
 * 2. Guards on `/:userId/*` and `/business/:id/*` use `matchesSession*`; on mismatch they
 *    `Navigate` to the canonical **home** for that session type.
 * 3. Feature pages (mode picker, menu) navigate using the same helpers so URL and session stay aligned.
 */
import type { AuthSession } from "@/auth/types";

/** MongoDB ObjectId as 24 hex chars (case-insensitive). */
const MONGO_OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

export function isLikelyMongoObjectIdString(value: string | undefined): boolean {
  return Boolean(value && MONGO_OBJECT_ID_HEX.test(value));
}

/**
 * True when the URL `:userId` matches the logged-in person account.
 * Use on `/:userId/*` routes; never trust the path alone for authorization (backend is source of truth).
 */
export function matchesSessionUserId(
  paramUserId: string | undefined,
  user: AuthSession | null | undefined,
): boolean {
  if (!paramUserId || !user || user.type !== "user") return false;
  return paramUserId === user.id;
}

/**
 * True when the URL `:businessId` matches the logged-in business (tenant) account.
 */
export function matchesSessionBusinessId(
  paramBusinessId: string | undefined,
  user: AuthSession | null | undefined,
): boolean {
  if (!paramBusinessId || !user || user.type !== "business") return false;
  return paramBusinessId === user.id;
}

/** Tenant base: `/business/:businessId` (child routes: `home`, `profile`, …). */
export function canonicalBusinessDashboardPath(user: AuthSession): string {
  return `/business/${user.id}`;
}

export function canonicalBusinessHomePath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/home`;
}

export function canonicalUserCustomerPath(user: AuthSession): string {
  return `/${user.id}/customer`;
}

export function canonicalUserCustomerHomePath(user: AuthSession): string {
  return `${canonicalUserCustomerPath(user)}/home`;
}

export function canonicalUserModePath(user: AuthSession): string {
  return `/${user.id}/mode`;
}

export function canonicalUserEmployeePath(user: AuthSession): string {
  return `/${user.id}/employee`;
}

export function canonicalUserEmployeeHomePath(user: AuthSession): string {
  return `${canonicalUserEmployeePath(user)}/home`;
}
