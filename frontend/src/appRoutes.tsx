/**
 * Route tree — see `App.tsx` for high-level map. Export **`AppRoutes`** for tests (`MemoryRouter`).
 *
 * Shells use guards from `routes/AuthRouteGuards.tsx` (documented there). Redirect helpers for
 * legacy `/app` and catch-all use `routes/canonicalPaths.ts` so URLs match the `home` segments here.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { AppPendingShell } from "@/components/AppPendingShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessLayout from "@/layouts/BusinessLayout";
import CustomerLayout from "@/layouts/CustomerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import PublicLayout from "@/layouts/PublicLayout";
import AccessDenied from "@/pages/AccessDenied";
import BusinessHomePage from "@/pages/business/BusinessHomePage";
import CustomerHomePage from "@/pages/customer/CustomerHomePage";
import EmployeeHomePage from "@/pages/employee/EmployeeHomePage";
import SelectUserModePage from "@/pages/SelectUserModePage";
import {
  BusinessSessionRouteShell,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireEmployeeAuthMode,
  SessionLoading,
  UserSessionRouteShell,
} from "@/routes/AuthRouteGuards";
import BusinessProfilePage from "./pages/business/BusinessProfilePage";
import { canonicalBusinessHomePath, canonicalUserCustomerHomePath } from "./routes/canonicalPaths";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const BusinessRegisterPage = lazy(() => import("@/pages/business/BusinessRegisterPage"));
const BusinessDashboardPage = lazy(() => import("@/pages/business/BusinessDashboardPage"));
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
  if (state.user.type === "business") {
    return <Navigate to={canonicalBusinessHomePath(state.user)} replace />;
  }
  return <Navigate to={canonicalUserCustomerHomePath(state.user)} replace />;
}

function CatchAllRedirect() {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return <SessionLoading />;
  }

  if (state.status === "authenticated" && state.user) {
    return <Navigate to={getPostLoginDestination(state.user)} replace />;
  }

  return <Navigate to="/" replace />;
}

/** Compose with `BrowserRouter` (app) or `MemoryRouter` (tests). */
export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppPendingShell variant="route" />}>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<CustomerHomePage />} />
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
            <Route path="business" element={<BusinessHomePage />} />
            <Route
              path="business/register"
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
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<BusinessHomePage />} />
            <Route path="dashboard" element={<BusinessDashboardPage />} />
            <Route path="profile" element={<BusinessProfilePage />} />
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
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<CustomerHomePage />} />
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
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<EmployeeHomePage />} />
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
