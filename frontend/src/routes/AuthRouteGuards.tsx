import type { ReactElement } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { useAuthMode } from "@/auth";
import { AppPendingShell } from "@/components/AppPendingShell";
import {
  canonicalBusinessDashboardPath,
  canonicalUserCustomerPath,
  matchesSessionBusinessId,
  matchesSessionUserId,
} from "@/routes/sessionPathGuards";

/** Static path for session-type partition violations (`RequireUserSession` / `RequireBusinessSession`). */
export const ACCESS_DENIED_PATH = "/access-denied";

/** Auth / guard pending state — same shell as route loading, different copy (see `AppPendingShell`). */
export function SessionLoading(props?: { message?: string }) {
  const message = props?.message ?? "Loading session…";
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

/** Ensures `:userId` matches session (`state.user.id`). Optional ObjectId validation: `isLikelyMongoObjectIdString` in `sessionPathGuards.ts`. */
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
    return <Navigate to={canonicalUserCustomerPath(user)} replace />;
  }

  return children;
}

/**
 * Employee shell only when the HttpOnly **`auth_mode`** cookie is **employee** (`GET /api/v1/auth/mode`).
 * Deep link to **`/:userId/employee`** with **`customer`** mode → **`Navigate`** to **`/:userId/mode`** (Phase 3.5.1).
 * On mode fetch error, same redirect so the user can retry **Continue as employee** or use customer.
 */
export function RequireEmployeeAuthMode({ children }: { children: ReactElement }) {
  const { userId } = useParams<{ userId: string }>();
  const { mode, isLoading, isError } = useAuthMode();

  if (!userId) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <SessionLoading message="Checking workspace mode…" />;
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
    return <Navigate to={canonicalBusinessDashboardPath(user)} replace />;
  }

  return children;
}
