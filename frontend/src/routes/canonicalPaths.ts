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
 * - `components/AccountMenuPopover.tsx` — account menu (profile; business stubs: subscriptions, address, credentials).
 * - `pages/SelectUserModePage.tsx` — navigate to customer or employee **dashboard** after mode selection.
 *
 * ## How it wires to the router
 * `appRoutes.tsx` declares concrete `<Route path="…">` segments (`dashboard`,
 * `settings/profile`, `settings/subscriptions`, `settings/address`, …). Those
 * paths must match what the `canonical*` helpers build (e.g. tenant landing is
 * `/business/:id/dashboard`, not the bare `/business/:id`). If you add a new shell segment, add a
 * helper here and use it in guards + post-login + any feature navigation.
 *
 * ## Flow (typical)
 * 1. User signs in → `getPostLoginDestination` uses `canonicalBusinessDashboardRoutePath` /
 *    `canonicalUserCustomerDashboardPath` / `canonicalUserModePath` depending on session shape.
 * 2. Guards on `/:userId/*` and `/business/:id/*` use `matchesSession*`; on mismatch they
 *    `Navigate` to the canonical **dashboard** for that session type.
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

/** Tenant base: `/business/:businessId` (child routes: `dashboard`, `settings/profile`, …). */
export function canonicalBusinessDashboardPath(user: AuthSession): string {
  return `/business/${user.id}`;
}

export function canonicalBusinessDashboardRoutePath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/dashboard`;
}

export function canonicalBusinessProfilePath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/profile`;
}

export function canonicalBusinessSettingsDeliveryPath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/delivery`;
}

export function canonicalBusinessSettingsMetricsPath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/metrics`;
}

export function canonicalBusinessSettingsSubscriptionsPath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/subscriptions`;
}

export function canonicalBusinessSettingsAddressPath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/address`;
}

export function canonicalBusinessSettingsOpenHoursPath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/open-hours`;
}

export function canonicalBusinessSettingsCredentialsPath(user: AuthSession): string {
  return `${canonicalBusinessDashboardPath(user)}/settings/credentials`;
}

export function canonicalUserCustomerPath(user: AuthSession): string {
  return `/${user.id}/customer`;
}

export function canonicalUserCustomerDashboardPath(user: AuthSession): string {
  return `${canonicalUserCustomerPath(user)}/dashboard`;
}

export function canonicalUserCustomerProfilePath(user: AuthSession): string {
  return `${canonicalUserCustomerPath(user)}/profile`;
}

export function canonicalUserCustomerFavoritesPath(user: AuthSession): string {
  return `${canonicalUserCustomerPath(user)}/favorites`;
}

export function canonicalUserModePath(user: AuthSession): string {
  return `/${user.id}/mode`;
}

export function canonicalUserEmployeePath(user: AuthSession): string {
  return `/${user.id}/employee`;
}

export function canonicalUserEmployeeDashboardPath(user: AuthSession): string {
  return `${canonicalUserEmployeePath(user)}/dashboard`;
}

export function canonicalUserEmployeeProfilePath(user: AuthSession): string {
  return `${canonicalUserEmployeePath(user)}/profile`;
}

/** Default dashboard for a session when no explicit mode-choice step is required. */
export function canonicalDefaultDashboardPath(user: AuthSession): string {
  if (user.type === "business") {
    return canonicalBusinessDashboardRoutePath(user);
  }
  return canonicalUserCustomerDashboardPath(user);
}
