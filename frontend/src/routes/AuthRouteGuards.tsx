/**
 * Auth-aware route wrappers used by `appRoutes.tsx` (and testable in isolation).
 *
 * ## Role
 * React components that read `useAuth` (and sometimes `useAuthMode`) and either render
 * `children` or a redirect / loading shell. They do **not** define URL strings by hand for
 * session-correct destinations — those come from `canonicalPaths.ts` and `getPostLoginDestination`.
 *
 * ## Composition (outer → inner)
 * - `BusinessRouteShell` = `ProtectedRoute` → `BusinessModeGuard` → venue layout/page. The guard
 *   requires the venue in the accessible-venue list with `canEnterBusiness`, switches an eligible
 *   Customer-mode deep link to Business, and redirects ineligible visits to the Customer dashboard
 *   with a localized explanation.
 * - Customer and account areas = `CustomerRouteShell` = `ProtectedRoute` → `CustomerModeGuard`.
 *   These destinations always render; a stored Business mode is reconciled to Customer, with a
 *   localized notice when reconciliation fails.
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
 * - `/dashboard`, `/favorites` → `CustomerRouteShell` + `CustomerLayout`.
 * - `/account/*` → `CustomerRouteShell` + `CustomerAccountLayout`; `/profile` redirects to
 *   `/account/profile`.
 * - `/employee/*` → `ProtectedRoute` + compatibility redirects (no employee shell).
 * - Legacy `/:userId/...` URLs redirect in `appRoutes.tsx` (ADR-0013).
 *
 * ## Circular note
 * `PublicOnlyRoute` imports `getPostLoginDestination`, which imports `canonicalPaths`. This file
 * imports `canonicalPaths` for guard redirects only — no cycle with postLoginRedirect.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  authPathWithReturnTo,
  getPostLoginDestination,
  getReturnToParam,
} from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { AppPendingShell } from "@/components/AppPendingShell";
import type { ModeNoticeNavigationState } from "@/components/ModeNotice";
import { Alert } from "@/components/ui/alert";
import { useAuthMode } from "@/context/AuthModeContext";
import { useAccessibleVenuesQuery } from "@/services/authVenues";
import { canonicalCustomerDashboardPath } from "./canonicalPaths";

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

/** How often an open Business destination re-checks venue eligibility. */
const BUSINESS_ELIGIBILITY_POLL_MS = 60_000;

/**
 * Customer destinations are always available to a signed-in User. When the
 * stored mode is Business, reconcile it to Customer so a deep link cannot leave
 * the session claiming a workspace the URL does not show. A failed
 * reconciliation keeps the destination rendered with a localized notice.
 */
export function CustomerRouteShell({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute>
      <CustomerModeGuard>{children}</CustomerModeGuard>
    </ProtectedRoute>
  );
}

function CustomerModeGuard({ children }: { children: ReactElement }) {
  const { t } = useTranslation("mode");
  const { mode, isError, setModeAndRefresh } = useAuthMode();
  const [reconcileFailed, setReconcileFailed] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (mode !== "business") {
      attemptedRef.current = false;
      return;
    }
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    void setModeAndRefresh("customer").catch(() => {
      setReconcileFailed(true);
    });
  }, [mode, setModeAndRefresh]);

  const notice = isError
    ? t("guard.modeLoadFailed")
    : reconcileFailed
      ? t("guard.reconcileFailed")
      : null;

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      {notice ? (
        <div className="w-full px-6 pt-4">
          <Alert>{notice}</Alert>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Authenticated User routes for a venue's data pages under `/business/:businessId`. */
export function BusinessRouteShell({ children }: { children: ReactElement }) {
  const { businessId } = useParams<{ businessId: string }>();

  if (businessId && RETIRED_BUSINESS_AUTH_SEGMENTS.has(businessId)) {
    return <Navigate to="/signup" replace />;
  }

  return (
    <ProtectedRoute>
      <BusinessModeGuard businessId={businessId}>{children}</BusinessModeGuard>
    </ProtectedRoute>
  );
}

/**
 * Business destinations require the venue to be in the accessible-venue list
 * with `canEnterBusiness`. A Customer-mode deep link switches the stored mode
 * when eligible; anything else redirects to the Customer dashboard with a
 * localized explanation. The per-venue access snapshot stays with the shell
 * (`BusinessLayout`) for layer and capabilities.
 */
function BusinessModeGuard({
  businessId,
  children,
}: {
  businessId: string | undefined;
  children: ReactElement;
}) {
  const { mode, isLoading: isModeLoading, isError: isModeError, setModeAndRefresh } =
    useAuthMode();
  const navigate = useNavigate();
  const venuesQuery = useAccessibleVenuesQuery({
    revalidateEligibility: true,
    refetchInterval: BUSINESS_ELIGIBILITY_POLL_MS,
  });
  const [failedBusinessId, setFailedBusinessId] = useState<string | null>(null);
  const attemptedRef = useRef(false);
  const switchSucceededRef = useRef(false);

  const venue = businessId
    ? venuesQuery.data?.find((item) => item.businessId === businessId)
    : undefined;
  const canEnter = Boolean(venue?.canEnterBusiness);
  const switchFailed = failedBusinessId === businessId;

  useEffect(() => {
    attemptedRef.current = false;
    switchSucceededRef.current = false;
  }, [businessId]);

  useEffect(() => {
    if (!canEnter || mode !== "customer" || attemptedRef.current) return;
    attemptedRef.current = true;
    void setModeAndRefresh("business")
      .then(() => {
        switchSucceededRef.current = true;
      })
      .catch(() => {
        setFailedBusinessId(businessId ?? null);
      });
  }, [businessId, canEnter, mode, setModeAndRefresh]);

  // A Business route that already switched the session now sees Customer mode:
  // another tab changed it, so honour that and leave the Business URL behind.
  useEffect(() => {
    if (mode === "customer" && switchSucceededRef.current) {
      navigate(canonicalCustomerDashboardPath(), { replace: true });
    }
  }, [mode, navigate]);

  if (venuesQuery.isLoading || isModeLoading) {
    return <SessionLoading />;
  }

  if (isModeError) {
    return (
      <Navigate
        to={canonicalCustomerDashboardPath()}
        replace
        state={
          {
            modeNotice: "modeLoadFailed",
          } satisfies ModeNoticeNavigationState
        }
      />
    );
  }

  if (venuesQuery.isError) {
    return (
      <Navigate
        to={canonicalCustomerDashboardPath()}
        replace
        state={
          {
            modeNotice: "businessCheckFailed",
          } satisfies ModeNoticeNavigationState
        }
      />
    );
  }

  if (switchFailed) {
    return (
      <Navigate
        to={canonicalCustomerDashboardPath()}
        replace
        state={
          {
            modeNotice: "modeSwitchFailed",
          } satisfies ModeNoticeNavigationState
        }
      />
    );
  }

  if (!businessId || !canEnter) {
    return (
      <Navigate
        to={canonicalCustomerDashboardPath()}
        replace
        state={
          {
            modeNotice: "businessUnavailable",
          } satisfies ModeNoticeNavigationState
        }
      />
    );
  }

  if (mode === "business") {
    return children;
  }

  // Wait for the mode read to confirm Business before rendering the shell.
  return <SessionLoading />;
}
