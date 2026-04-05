/**
 * Route tree — see `App.tsx` for high-level map. Export **`AppRoutes`** for tests (`MemoryRouter`).
 *
 * Shells use guards from `routes/AuthRouteGuards.tsx` (documented there). Redirect helpers for
 * legacy `/app` and catch-all use `routes/canonicalPaths.ts` so URLs stay dashboard-first.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { AppPendingShell } from "@/components/AppPendingShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessLayout from "@/layouts/BusinessLayout";
import CustomerLayout from "@/layouts/CustomerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import PublicLayout from "@/layouts/PublicLayout";
import AccessDenied from "@/pages/AccessDenied";
import NotFoundPage from "@/pages/NotFoundPage";
import SelectUserModePage from "@/pages/SelectUserModePage";
import CustomerMarketingPage from "@/pages/marketing/CustomerMarketingPage";
import BusinessMarketingPage from "@/pages/marketing/BusinessMarketingPage";
import {
  BusinessSessionRouteShell,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireEmployeeAuthMode,
  SessionLoading,
  UserSessionRouteShell,
} from "@/routes/AuthRouteGuards";
import {
  canonicalDefaultDashboardPath,
} from "./routes/canonicalPaths";
import BusinessRegisterPage from "./pages/business/BusinessRegisterPage";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ConfirmEmailPage = lazy(() => import("@/pages/ConfirmEmailPage"));
const RequestEmailConfirmationPage = lazy(
  () => import("@/pages/RequestEmailConfirmationPage"),
);
const BusinessDashboardPage = lazy(() => import("@/pages/business/BusinessDashboardPage"));
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
const BusinessCredentialsSettingsPage = lazy(
  () => import("@/pages/business/BusinessCredentialsSettingsPage"),
);
const BusinessProfileSettingsPage = lazy(
  () => import("@/pages/business/BusinessProfileSettingsPage"),
);
const CustomerProfilePage = lazy(() => import("@/pages/customer/CustomerProfilePage"));
const CustomerFavoritesPage = lazy(() => import("@/pages/customer/CustomerFavoritesPage"));
const CustomerDashboardPage = lazy(() => import("@/pages/customer/CustomerDashboardPage"));
const EmployeeProfilePage = lazy(() => import("@/pages/employee/EmployeeProfilePage"));
const EmployeeDashboardPage = lazy(() => import("@/pages/employee/EmployeeDashboardPage"));

function LegacyAppRedirect() {
  const { state } = useAuth();
  if (!state.user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={canonicalDefaultDashboardPath(state.user)} replace />;
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
    return <Navigate to={canonicalDefaultDashboardPath(state.user)} replace />;
  }

  return <CustomerMarketingPage />;
}

function PublicBusinessRoute() {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status === "authenticated" && state.user) {
    return <Navigate to={canonicalDefaultDashboardPath(state.user)} replace />;
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
            <Route
              path="forgot-password"
              element={
                <PublicOnlyRoute>
                  <ForgotPasswordPage />
                </PublicOnlyRoute>
              }
            />
            {/** Token links from email; must work even when a session exists. */}
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="confirm-email" element={<ConfirmEmailPage />} />
            <Route
              path="request-email-confirmation"
              element={
                <PublicOnlyRoute>
                  <RequestEmailConfirmationPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="business" element={<PublicBusinessRoute />} />
            <Route
              path="business/register"
              element={
                <PublicOnlyRoute>
                  <BusinessRegisterPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="business/signup"
              element={
                <PublicOnlyRoute>
                  <BusinessRegisterPage />
                </PublicOnlyRoute>
              }
            />
          </Route>

          <Route path="/access-denied" element={<AccessDenied />} />

          <Route
            path="/business/:businessId"
            element={
              <BusinessSessionRouteShell>
                <BusinessLayout />
              </BusinessSessionRouteShell>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<BusinessDashboardPage />} />
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
            <Route
              path="settings/credentials"
              element={<BusinessCredentialsSettingsPage />}
            />
          </Route>

          <Route
            path="/:userId/mode"
            element={
              <UserSessionRouteShell>
                <SelectUserModePage />
              </UserSessionRouteShell>
            }
          />

          <Route
            path="/:userId/customer"
            element={
              <UserSessionRouteShell>
                <CustomerLayout />
              </UserSessionRouteShell>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="profile" element={<CustomerProfilePage />} />
            <Route path="favorites" element={<CustomerFavoritesPage />} />
            <Route path="dashboard" element={<CustomerDashboardPage />} />
          </Route>

          <Route
            path="/:userId/employee"
            element={
              <UserSessionRouteShell>
                <RequireEmployeeAuthMode>
                  <EmployeeLayout />
                </RequireEmployeeAuthMode>
              </UserSessionRouteShell>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="profile" element={<EmployeeProfilePage />} />
            <Route path="dashboard" element={<EmployeeDashboardPage />} />
          </Route>

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
