/**
 * Auth-aware route wrappers used by `appRoutes.tsx` (and testable in isolation).
 *
 * ## Role
 * React components that read `useAuth` (and sometimes `useAuthMode`) and either render
 * `children` or a redirect / loading shell. They do **not** define URL strings by hand for
 * session-correct destinations — those come from `canonicalPaths.ts` and `getPostLoginDestination`.
 *
 * ## Composition (outer → inner)
 * - `UserSessionRouteShell` = `ProtectedRoute` → `RequireUserSession` → `UserIdRouteGuard` → layout/page.
 * - `BusinessSessionRouteShell` = `ProtectedRoute` → `RequireBusinessSession` → `BusinessIdRouteGuard` → layout/page.
 * - Employee area adds `RequireEmployeeAuthMode` **inside** `UserSessionRouteShell` (must be under
 *   `/:userId/employee` so params and cookie mode check apply).
 *
 * ## Wiring (`appRoutes.tsx`)
 * - Public routes: `PublicOnlyRoute` on `/login`, `/signup`, `/business/register` — if already
 *   authenticated, redirect via `getPostLoginDestination` (auth/postLoginRedirect.ts).
 * - `/business/:businessId/*` → `BusinessSessionRouteShell` + `BusinessLayout`.
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
import { useAuthMode } from "@/auth";
import { AppPendingShell } from "@/components/AppPendingShell";
import { canonicalBusinessHomePath, canonicalUserCustomerHomePath, matchesSessionBusinessId, matchesSessionUserId } from "./canonicalPaths";

/** Static path for session-type partition violations (`RequireUserSession` / `RequireBusinessSession`). */
export const ACCESS_DENIED_PATH = "/access-denied";

/** Auth / guard pending state — same shell as route loading, different copy (see `AppPendingShell`). */
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

/** Requires authenticated **user** (`type === "user"`). Wrong session type → `ACCESS_DENIED_PATH`. */
export function RequireUserSession({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status !== "authenticated" || !state.user) {
    return <Navigate to="/login" replace />;
  }

  if (state.user.type !== "user") {
    return <Navigate to={ACCESS_DENIED_PATH} replace />;
  }

  return children;
}

/** Requires authenticated **business** (`type === "business"`). Wrong session type → `ACCESS_DENIED_PATH`. */
export function RequireBusinessSession({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status !== "authenticated" || !state.user) {
    return <Navigate to="/login" replace />;
  }

  if (state.user.type !== "business") {
    return <Navigate to={ACCESS_DENIED_PATH} replace />;
  }

  return children;
}

/**
 * Authenticated **person** routes: session loaded, `type === "user"`, and URL `:userId` matches `state.user.id`.
 * Use for `/:userId/mode`, `/:userId/customer`, `/:userId/employee` shells.
 */
export function UserSessionRouteShell({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute>
      <RequireUserSession>
        <UserIdRouteGuard>{children}</UserIdRouteGuard>
      </RequireUserSession>
    </ProtectedRoute>
  );
}

/**
 * Authenticated **business** tenant routes: session loaded, `type === "business"`, and `:businessId` matches.
 */
export function BusinessSessionRouteShell({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute>
      <RequireBusinessSession>
        <BusinessIdRouteGuard>{children}</BusinessIdRouteGuard>
      </RequireBusinessSession>
    </ProtectedRoute>
  );
}

/** Ensures `:userId` matches session (`state.user.id`). Optional ObjectId validation: `isLikelyMongoObjectIdString` in `canonicalPaths.ts`. */
export function UserIdRouteGuard({ children }: { children: ReactElement }) {
  const { userId } = useParams();
  const { state } = useAuth();
  const user = state.user;

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (!user || user.type !== "user") {
    return <Navigate to="/login" replace />;
  }

  if (!matchesSessionUserId(userId, user)) {
    return <Navigate to={canonicalUserCustomerHomePath(user)} replace />;
  }

  return children;
}

/**
 * Employee shell only when the HttpOnly **`auth_mode`** cookie is **employee** (`GET /api/v1/auth/mode`).
 * Deep link to **`/:userId/employee`** with **`customer`** mode → **`Navigate`** to **`/:userId/mode`** (Phase 3.5.1).
 * On mode fetch error, same redirect so the user can retry **Continue as employee** or use customer.
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

  if (isError || mode !== "employee") {
    return <Navigate to={`/${userId}/mode`} replace />;
  }

  return children;
}

/** Ensures `:businessId` matches session (`state.user.id` for `type === "business"`). */
export function BusinessIdRouteGuard({ children }: { children: ReactElement }) {
  const { businessId } = useParams();
  const { state } = useAuth();
  const user = state.user;

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (!user || user.type !== "business") {
    return <Navigate to="/login" replace />;
  }

  if (!matchesSessionBusinessId(businessId, user)) {
    return <Navigate to={canonicalBusinessHomePath(user)} replace />;
  }

  return children;
}
