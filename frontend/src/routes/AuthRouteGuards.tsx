/**
 * Auth-aware route wrappers used by `appRoutes.tsx` (and testable in isolation).
 *
 * ## Role
 * React components that read `useAuth` (and sometimes `useAuthMode`) and either render
 * `children` or a redirect / loading shell. They do **not** define URL strings by hand for
 * session-correct destinations — those come from `canonicalPaths.ts` and `getPostLoginDestination`.
 *
 * ## Composition (outer → inner)
 * - `UserSessionRouteShell` = `ProtectedRoute` → `UserIdRouteGuard` → layout/page.
 * - `BusinessRouteShell` = `ProtectedRoute` → venue layout/page. Venue data pages only need the
 *   signed-in User; the shared business-mode eligibility seam is `AuthModeContext` /
 *   `RequireEmployeeAuthMode`, while the full toggle and navigation chrome remain 1.7.
 * - Employee area adds `RequireEmployeeAuthMode` **inside** `UserSessionRouteShell` (must be under
 *   `/:userId/employee` so params and session-mode check apply).
 *
 * ## Wiring (`appRoutes.tsx`)
 * - Public routes: `PublicOnlyRoute` on `/login`, `/signup`, `/forgot-password`
 *   — if already authenticated, redirect via `getPostLoginDestination` (auth/postLoginRedirect.ts).
 *   `/reset-password` and `/confirm-email` stay reachable with an existing session (email links).
 * - `/business/:businessId/*` → `BusinessRouteShell` + `BusinessLayout`.
 * - `/:userId/mode` → `UserSessionRouteShell` + mode page.
 * - `/:userId/customer/*` → `UserSessionRouteShell` + `CustomerLayout`.
 * - `/:userId/employee/*` → `UserSessionRouteShell` → `RequireEmployeeAuthMode` + `EmployeeLayout`.
 *
 * ## Circular note
 * `PublicOnlyRoute` imports `getPostLoginDestination`, which imports `canonicalPaths`. This file
 * imports `canonicalPaths` for guard redirects only — no cycle with postLoginRedirect.
 */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { useAuthMode } from "@/context/AuthModeContext";
import { AppPendingShell } from "@/components/AppPendingShell";
import {
  canonicalUserCustomerDashboardPath,
  matchesSessionUserId,
} from "./canonicalPaths";

/** Auth / guard pending state — same skeleton shell as route loading; status text is sr-only (see `AppPendingShell`). */
export function SessionLoading(props?: { message?: string }) {
  const { t } = useTranslation("common");
  const message = props?.message ?? t("loading.session");
  return <AppPendingShell variant="session" message={message} />;
}

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status !== "authenticated" || !state.user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status === "authenticated" && state.user) {
    return <Navigate to={getPostLoginDestination(state.user)} replace />;
  }

  return children;
}

/**
 * Authenticated User routes under `/:userId`: session loaded and URL `:userId` matches `state.user.id`.
 * Use for `/:userId/mode`, `/:userId/customer`, `/:userId/employee` shells.
 */
export function UserSessionRouteShell({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute>
      <UserIdRouteGuard>{children}</UserIdRouteGuard>
    </ProtectedRoute>
  );
}

/** Retired business-auth URLs that must not be mistaken for a venue id. */
const RETIRED_BUSINESS_AUTH_SEGMENTS = new Set(["register", "signup"]);

/** Authenticated User routes for a venue's data pages under `/business/:businessId`. */
export function BusinessRouteShell({ children }: { children: ReactElement }) {
  const { businessId } = useParams<{ businessId: string }>();

  if (businessId && RETIRED_BUSINESS_AUTH_SEGMENTS.has(businessId)) {
    return <Navigate to="/signup?audience=business" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/** Ensures `:userId` matches session (`state.user.id`). */
export function UserIdRouteGuard({ children }: { children: ReactElement }) {
  const { userId } = useParams();
  const { state } = useAuth();
  const user = state.user;

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!matchesSessionUserId(userId, user)) {
    return <Navigate to={canonicalUserCustomerDashboardPath(user)} replace />;
  }

  return children;
}

/**
 * Employee shell only when the session-stored mode is **business** (`GET /api/v1/auth/mode`).
 * Deep link to **`/:userId/employee`** with **`customer`** mode → **`Navigate`** to **`/:userId/mode`** (Phase 3.5.1).
 * On mode fetch error, same redirect so the user can retry **Continue as business** or use customer.
 */
export function RequireEmployeeAuthMode({ children }: { children: ReactElement }) {
  const { t } = useTranslation("common");
  const { userId } = useParams<{ userId: string }>();
  const { mode, isLoading, isError } = useAuthMode();

  if (!userId) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <SessionLoading message={t("loading.checkingWorkspaceMode")} />;
  }

  if (isError || mode !== "business") {
    return <Navigate to={`/${userId}/mode`} replace />;
  }

  return children;
}
