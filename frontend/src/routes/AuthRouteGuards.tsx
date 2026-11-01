/**
 * Auth-aware route wrappers used by `appRoutes.tsx` (and testable in isolation).
 *
 * ## Role
 * React components that read `useAuth` (and sometimes `useAuthMode`) and either render
 * `children` or a redirect / loading shell. They do **not** define URL strings by hand for
 * session-correct destinations — those come from `canonicalPaths.ts` and `getPostLoginDestination`.
 *
 * ## Composition (outer → inner)
 * - `BusinessRouteShell` = `ProtectedRoute` → venue layout/page. Venue data pages only need the
 *   signed-in User; the shared business-mode eligibility seam is `AuthModeContext` and the
 *   accessible-venue read.
 * - Customer and account areas = `ProtectedRoute` → layout/page.
 * - Retired `/employee/*` URLs are compatibility redirects (`routes/EmployeeRedirects.tsx`).
 *
 * ## Wiring (`appRoutes.tsx`)
 * - Public routes: `PublicOnlyRoute` on `/login`, `/signup`, `/forgot-password`
 *   — if already authenticated, redirect via `getPostLoginDestination` and any safe `returnTo`
 *   query parameter (auth/postLoginRedirect.ts). `/reset-password` and `/confirm-email` stay
 *   reachable with an existing session (email links).
 * - `ProtectedRoute` sends anonymous visitors to `/login?returnTo=…` so the shared auth entry
 *   can restore the page that required identity.
 * - `/business/:businessId/*` → `BusinessRouteShell` + `BusinessLayout`.
 * - `/mode` → `ProtectedRoute` + mode page.
 * - `/dashboard`, `/favorites` → `ProtectedRoute` + `CustomerLayout`.
 * - `/account/*` → `ProtectedRoute` + `CustomerAccountLayout`; `/profile` redirects to
 *   `/account/profile`.
 * - `/employee/*` → `ProtectedRoute` + compatibility redirects (no employee shell).
 * - Legacy `/:userId/...` URLs redirect in `appRoutes.tsx` (ADR-0013).
 *
 * ## Circular note
 * `PublicOnlyRoute` imports `getPostLoginDestination`, which imports `canonicalPaths`. This file
 * imports `canonicalPaths` for guard redirects only — no cycle with postLoginRedirect.
 */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";
import {
  authPathWithReturnTo,
  getPostLoginDestination,
  getReturnToParam,
} from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { AppPendingShell } from "@/components/AppPendingShell";

/** Auth / guard pending state — same skeleton shell as route loading; status text is sr-only (see `AppPendingShell`). */
export function SessionLoading(props?: { message?: string }) {
  const { t } = useTranslation("common");
  const message = props?.message ?? t("loading.session");
  return <AppPendingShell variant="session" message={message} />;
}

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status !== "authenticated" || !state.user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={authPathWithReturnTo("/login", returnTo)} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status === "authenticated" && state.user) {
    const returnTo = getReturnToParam(location.search);
    return (
      <Navigate to={getPostLoginDestination(returnTo)} replace />
    );
  }

  return children;
}

/** Retired business-auth URLs that must not be mistaken for a venue id. */
const RETIRED_BUSINESS_AUTH_SEGMENTS = new Set(["register", "signup"]);

/** Authenticated User routes for a venue's data pages under `/business/:businessId`. */
export function BusinessRouteShell({ children }: { children: ReactElement }) {
  const { businessId } = useParams<{ businessId: string }>();

  if (businessId && RETIRED_BUSINESS_AUTH_SEGMENTS.has(businessId)) {
    return <Navigate to="/signup" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
