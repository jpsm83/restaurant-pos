/**
 * Canonical URLs & path matching for the app shell (`src/routes` — see `AuthRouteGuards.tsx`).
 *
 * ## Role
 * Pure functions only (no React). Every programmatic navigation or link that must stay in sync
 * with the route tree should derive paths from here so strings are not duplicated in pages.
 *
 * ## Self-service routes are session-derived
 * The signed-in User is request context, so `/dashboard`, `/profile`, `/favorites`, `/mode`, and
 * `/employee/*` carry no user id. An id appears in a URL only when the URL addresses that
 * resource: `/business/:businessId` is a venue the person may switch between. See ADR-0013.
 *
 * ## Who imports this
 * - `auth/postLoginRedirect.ts` — first URL after login / signup (`getPostLoginDestination`).
 * - `routes/AuthRouteGuards.tsx` — mode redirect and guard docs.
 * - `appRoutes.tsx` — legacy `/:userId/...` redirect targets.
 * - `context/AuthModeContext.tsx` — `isUserShellPath` enables the stored-mode query.
 * - `components/AccountMenuPopover.tsx` — profile entry point and employee-shell detection.
 * - `layouts/CustomerLayout.tsx`, `layouts/EmployeeLayout.tsx`, `layouts/BusinessLayout.tsx`.
 * - `pages/SelectUserModePage.tsx` — navigate to customer or employee **dashboard** after mode selection.
 *
 * ## How it wires to the router
 * `appRoutes.tsx` declares concrete `<Route path="…">` segments (`dashboard`, `profile`,
 * `favorites`, `settings/profile`, …). Those paths must match what the `canonical*` helpers
 * build. If you add a new shell segment, add a helper here and use it in guards + post-login +
 * any feature navigation. Legacy `/:userId/...` URLs redirect in `appRoutes.tsx`.
 *
 * ## Flow (typical)
 * 1. User signs in → `getPostLoginDestination` returns the Customer dashboard.
 * 2. Self-service routes render for the session without a path id.
 * 3. Venue data pages build `/business/:businessId/*` links from the route param, not the session.
 */

/** MongoDB ObjectId as 24 hex chars (case-insensitive). */
const MONGO_OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

export function isLikelyMongoObjectIdString(value: string | undefined): boolean {
  return Boolean(value && MONGO_OBJECT_ID_HEX.test(value));
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

/** Customer dashboard — the signed-in User's landing page. */
export function canonicalCustomerDashboardPath(): string {
  return "/dashboard";
}

export function canonicalCustomerProfilePath(): string {
  return "/profile";
}

export function canonicalCustomerFavoritesPath(): string {
  return "/favorites";
}

/** Customer | Business mode selection. */
export function canonicalModePath(): string {
  return "/mode";
}

export function canonicalEmployeePath(): string {
  return "/employee";
}

export function canonicalEmployeeDashboardPath(): string {
  return `${canonicalEmployeePath()}/dashboard`;
}

export function canonicalEmployeeProfilePath(): string {
  return `${canonicalEmployeePath()}/profile`;
}

/** Default dashboard for a signed-in User; Business is entered through the mode flow. */
export function canonicalDefaultDashboardPath(): string {
  return canonicalCustomerDashboardPath();
}

/** True when `pathname` is `path` or a descendant of it. */
function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isEmployeeShellPath(pathname: string): boolean {
  return matchesPath(pathname, canonicalEmployeePath());
}

/** True on the session-derived routes where the stored Customer | Business mode applies. */
export function isUserShellPath(pathname: string): boolean {
  return (
    matchesPath(pathname, canonicalCustomerDashboardPath()) ||
    matchesPath(pathname, canonicalCustomerProfilePath()) ||
    matchesPath(pathname, canonicalCustomerFavoritesPath()) ||
    matchesPath(pathname, canonicalModePath()) ||
    isEmployeeShellPath(pathname)
  );
}
