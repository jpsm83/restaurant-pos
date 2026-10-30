/**
 * Canonical URLs & path matching for the app shell (`src/routes` — see `AuthRouteGuards.tsx`).
 *
 * ## Role
 * Pure functions only (no React). Every programmatic navigation or link that must stay in sync
 * with the route tree should derive paths from here so strings are not duplicated in pages.
 *
 * ## Who imports this
 * - `AuthRouteGuards.tsx` — redirects when `:userId` does not match the session.
 * - `auth/postLoginRedirect.ts` — first URL after login / signup (`getPostLoginDestination`).
 * - `components/AccountMenuPopover.tsx` — User profile entry point.
 * - `layouts/BusinessLayout.tsx` and business venue pages — `:businessId` destination links.
 * - `pages/SelectUserModePage.tsx` — navigate to customer or employee **dashboard** after mode selection.
 *
 * ## How it wires to the router
 * `appRoutes.tsx` declares concrete `<Route path="…">` segments (`dashboard`,
 * `settings/profile`, `settings/subscriptions`, `settings/address`, …). Those
 * paths must match what the `canonical*` helpers build. If you add a new shell segment, add a
 * helper here and use it in guards + post-login + any feature navigation.
 *
 * ## Flow (typical)
 * 1. User signs in → `getPostLoginDestination` returns the Customer dashboard.
 * 2. Guards on `/:userId/*` use `matchesSessionUserId`; on mismatch they `Navigate` to the
 *    canonical Customer dashboard.
 * 3. Venue data pages build `/business/:businessId/*` links from the route param, not the session.
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
  if (!paramUserId || !user) return false;
  return paramUserId === user.id;
}

/** Venue base: `/business/:businessId` (child routes: `dashboard`, `settings/profile`, …). */
export function canonicalBusinessDashboardPath(businessId: string): string {
  return `/business/${businessId}`;
}

export function canonicalBusinessDashboardRoutePath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/dashboard`;
}

export function canonicalBusinessProfilePath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/settings/profile`;
}

/** The active venue's Company page (owner-only in the Business shell). */
export function canonicalBusinessCompanyPath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/company`;
}

export function canonicalBusinessSettingsDeliveryPath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/settings/delivery`;
}

export function canonicalBusinessSettingsMetricsPath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/settings/metrics`;
}

export function canonicalBusinessSettingsSubscriptionsPath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/settings/subscriptions`;
}

export function canonicalBusinessSettingsAddressPath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/settings/address`;
}

export function canonicalBusinessSettingsOpenHoursPath(businessId: string): string {
  return `${canonicalBusinessDashboardPath(businessId)}/settings/open-hours`;
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

/** Default dashboard for a signed-in User; Business is entered through the mode flow. */
export function canonicalDefaultDashboardPath(user: AuthSession): string {
  return canonicalUserCustomerDashboardPath(user);
}
