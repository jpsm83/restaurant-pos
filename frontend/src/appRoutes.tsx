/**
 * Route tree — see `App.tsx` for high-level map. Export **`AppRoutes`** for tests (`MemoryRouter`).
 *
 * Shells use guards from `routes/AuthRouteGuards.tsx` (documented there). Redirect helpers for
 * legacy `/app` and catch-all use `routes/canonicalPaths.ts` so URLs stay dashboard-first.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { AppPendingShell } from "@/components/AppPendingShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessLayout from "@/layouts/BusinessLayout";
import CustomerLayout from "@/layouts/CustomerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import PublicLayout from "@/layouts/PublicLayout";
import RecoveryLayout from "@/layouts/RecoveryLayout";
import AccessDenied from "@/pages/AccessDenied";
import NotFoundPage from "@/pages/NotFoundPage";
import SelectUserModePage from "@/pages/SelectUserModePage";
import CustomerMarketingPage from "@/pages/marketing/CustomerMarketingPage";
import BusinessMarketingPage from "@/pages/marketing/BusinessMarketingPage";
import {
  BusinessRouteShell,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireEmployeeAuthMode,
  SessionLoading,
} from "@/routes/AuthRouteGuards";
import {
  canonicalCustomerDashboardPath,
  canonicalCustomerFavoritesPath,
  canonicalCustomerProfilePath,
  canonicalDefaultDashboardPath,
  canonicalEmployeeDashboardPath,
  canonicalEmployeePath,
  canonicalEmployeeProfilePath,
  canonicalModePath,
  isLikelyMongoObjectIdString,
} from "./routes/canonicalPaths";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ConfirmEmailPage = lazy(() => import("@/pages/ConfirmEmailPage"));
const ConfirmEmailChangePage = lazy(
  () => import("@/pages/ConfirmEmailChangePage"),
);
const RequestEmailConfirmationPage = lazy(
  () => import("@/pages/RequestEmailConfirmationPage"),
);
const BusinessDashboardPage = lazy(() => import("@/pages/business/BusinessDashboardPage"));
const BusinessCompanyPage = lazy(
  () => import("@/pages/business/BusinessCompanyPage"),
);
const BusinessDeliverySettingsPage = lazy(
  () => import("@/pages/business/BusinessDeliverySettingsPage"),
);
const BusinessMetricsSettingsPage = lazy(
  () => import("@/pages/business/BusinessMetricsSettingsPage"),
);
const BusinessSubscriptionsSettingsPage = lazy(
  () => import("@/pages/business/BusinessSubscriptionsSettingsPage"),
);
const BusinessAddressSettingsPage = lazy(
  () => import("@/pages/business/BusinessAddressSettingsPage"),
);
const BusinessOpenHoursSettingsPage = lazy(
  () => import("@/pages/business/BusinessOpenHoursSettingsPage"),
);
const BusinessProfileSettingsPage = lazy(
  () => import("@/pages/business/BusinessProfileSettingsPage"),
);
const CustomerProfilePage = lazy(() => import("@/pages/customer/CustomerProfilePage"));
const CustomerFavoritesPage = lazy(() => import("@/pages/customer/CustomerFavoritesPage"));
const CustomerDashboardPage = lazy(() => import("@/pages/customer/CustomerDashboardPage"));
const EmployeeProfilePage = lazy(() => import("@/pages/employee/EmployeeProfilePage"));
const EmployeeDashboardPage = lazy(() => import("@/pages/employee/EmployeeDashboardPage"));

// Dev-only review surface: the static `DEV` check lets the production build
// drop the dynamic imports, their chunks, and the gallery's locale copy.
const DevThemeGalleryPage = import.meta.env.DEV
  ? lazy(async () => {
      const [{ default: Page }, { registerThemeGalleryResources }] =
        await Promise.all([
          import("@/pages/dev/ThemeGalleryPage"),
          import("@/pages/dev/themeGalleryResources"),
        ]);
      const { default: appI18n } = await import("@/i18n/i18n");
      registerThemeGalleryResources(appI18n);
      return { default: Page };
    })
  : null;

function LegacyAppRedirect() {
  const { state } = useAuth();
  if (!state.user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={canonicalDefaultDashboardPath()} replace />;
}

type LegacyUserShell = "customer" | "employee" | "mode";

const LEGACY_USER_PATHS: Record<
  LegacyUserShell,
  Readonly<Record<string, string>>
> = {
  mode: { "": canonicalModePath() },
  customer: {
    "": canonicalCustomerDashboardPath(),
    dashboard: canonicalCustomerDashboardPath(),
    profile: canonicalCustomerProfilePath(),
    favorites: canonicalCustomerFavoritesPath(),
  },
  employee: {
    "": canonicalEmployeePath(),
    dashboard: canonicalEmployeeDashboardPath(),
    profile: canonicalEmployeeProfilePath(),
  },
};

/**
 * Map a legacy `/:userId/<shell>/*` URL to its session-derived path, or `null` when the
 * remainder is unknown. Legacy URLs exist only so old bookmarks keep working (ADR-0013).
 */
function legacyUserPath(
  shell: LegacyUserShell,
  splat: string | undefined,
): string | null {
  const segment = (splat ?? "").replace(/\/+$/, "");
  const paths = LEGACY_USER_PATHS[shell];
  return Object.prototype.hasOwnProperty.call(paths, segment)
    ? paths[segment]
    : null;
}

/**
 * Redirects retired `/:userId/...` URLs when the id looks like a Mongo ObjectId. Unknown
 * shapes render the 404 page rather than guessing a destination.
 */
function LegacyUserRouteRedirect({ shell }: { shell: LegacyUserShell }) {
  const { userId, "*": splat } = useParams();
  const { search, hash } = useLocation();

  if (!isLikelyMongoObjectIdString(userId)) {
    return <NotFoundPage />;
  }

  const target = legacyUserPath(shell, splat);
  if (!target) {
    return <NotFoundPage />;
  }

  return <Navigate to={`${target}${search}${hash}`} replace />;
}

function CatchAllRedirect() {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  // Unknown URL: show the dedicated 404 page instead of redirecting.
  return <NotFoundPage />;
}

function PublicIndexRoute() {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  // Once authenticated, `/` is not a stable landing page for the app shell.
  // Send the user to their actor dashboard instead.
  if (state.status === "authenticated" && state.user) {
    return <Navigate to={canonicalDefaultDashboardPath()} replace />;
  }

  return <CustomerMarketingPage />;
}

function PublicBusinessRoute() {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status === "authenticated" && state.user) {
    return <Navigate to={canonicalDefaultDashboardPath()} replace />;
  }

  return <BusinessMarketingPage />;
}

/** Compose with `BrowserRouter` (app) or `MemoryRouter` (tests). */
export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppPendingShell variant="route" />}>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<PublicIndexRoute />} />
            <Route
              path="login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="signup"
              element={
                <PublicOnlyRoute>
                  <SignUpPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="business" element={<PublicBusinessRoute />} />
          </Route>

          {/**
           * Email / recovery flows: no `PublicLayout` footer; global navbar omitted via `AppRootShell`.
           * Reset + confirm must work even when a session cookie exists.
           */}
          <Route element={<RecoveryLayout />}>
            <Route
              path="forgot-password"
              element={
                <PublicOnlyRoute>
                  <ForgotPasswordPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="confirm-email" element={<ConfirmEmailPage />} />
            <Route
              path="confirm-email-change"
              element={<ConfirmEmailChangePage />}
            />
            <Route
              path="request-email-confirmation"
              element={
                <PublicOnlyRoute>
                  <RequestEmailConfirmationPage />
                </PublicOnlyRoute>
              }
            />
          </Route>

          <Route path="/access-denied" element={<AccessDenied />} />

          {DevThemeGalleryPage ? (
            <Route path="/dev/themes" element={<DevThemeGalleryPage />} />
          ) : null}

          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <BusinessLayout />
              </BusinessRouteShell>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<BusinessDashboardPage />} />
            <Route path="company" element={<BusinessCompanyPage />} />
            <Route
              path="settings/profile"
              element={<BusinessProfileSettingsPage />}
            />
            <Route
              path="settings/delivery"
              element={<BusinessDeliverySettingsPage />}
            />
            <Route
              path="settings/metrics"
              element={<BusinessMetricsSettingsPage />}
            />
            <Route
              path="settings/subscriptions"
              element={<BusinessSubscriptionsSettingsPage />}
            />
            <Route path="settings/address" element={<BusinessAddressSettingsPage />} />
            <Route
              path="settings/open-hours"
              element={<BusinessOpenHoursSettingsPage />}
            />
          </Route>

          <Route
            path="/mode"
            element={
              <ProtectedRoute>
                <SelectUserModePage />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <CustomerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<CustomerDashboardPage />} />
            <Route path="profile" element={<CustomerProfilePage />} />
            <Route path="favorites" element={<CustomerFavoritesPage />} />
          </Route>

          <Route
            path="/employee"
            element={
              <ProtectedRoute>
                <RequireEmployeeAuthMode>
                  <EmployeeLayout />
                </RequireEmployeeAuthMode>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="profile" element={<EmployeeProfilePage />} />
            <Route path="dashboard" element={<EmployeeDashboardPage />} />
          </Route>

          {/* Retired id-based URLs (ADR-0013) — keep old bookmarks working. */}
          <Route
            path="/:userId/mode"
            element={<LegacyUserRouteRedirect shell="mode" />}
          />
          <Route
            path="/:userId/customer/*"
            element={<LegacyUserRouteRedirect shell="customer" />}
          />
          <Route
            path="/:userId/employee/*"
            element={<LegacyUserRouteRedirect shell="employee" />}
          />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <LegacyAppRedirect />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<CatchAllRedirect />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
