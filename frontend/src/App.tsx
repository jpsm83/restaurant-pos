/**
 * Route map — Team decisions (see FRONTEND_AUTH_NAVIGATION_IMPLEMENTATION_PLAN.md §Phase 0.1).
 *
 * | Area | Path |
 * |------|------|
 * | Public user marketing | `/` |
 * | Public business marketing | `/business` |
 * | Tenant shell (auth business) | `/business/:businessId` (`BusinessLayout`) |
 * | User customer shell | `/:userId/customer` (`CustomerLayout`) |
 * | User employee shell | `/:userId/employee` (`EmployeeLayout`) |
 * | Mode selection (staff) | `/:userId/mode` |
 *
 * Public tree (Phase 1.4): nested under `path="/"` + `PublicLayout` — `index` → customer home,
 * `login`, `signup`, `business`, `business/register`. Static `/access-denied` (Phase 2.3) before
 * `/:userId/*`. Then `/business/:businessId`, then user shell routes.
 * Legacy `/app`: business → `/business/:id`; user → `/:userId/customer` (not mode — use normal login flow).
 * Unknown paths (`*`): anonymous → `/`; authenticated → `getPostLoginDestination` (Phase 2.6).
 *
 * URL ↔ session: `:userId` must equal `state.user.id` for `type === "user"`; `:businessId` must equal
 * `state.user.id` for `type === "business"`. Helpers: `routes/sessionPathGuards.ts`.
 *
 * Resilience: **`AppRoutes`** wraps **`Routes`** with **ErrorBoundary** + **Suspense** (lazy chunks;
 * fallback **`AppPendingShell` variant `route`**). Guards use **`SessionLoading`** → **`AppPendingShell`**
 * **`session`**. Root **`main.tsx`** still wraps **`App`** in **`ErrorBoundary`**.
 *
 * Task 0.1.4 — Countdown: schedules from backend → TanStack Query + local UI state → disabled Employee
 * button countdown; refetch at zero / `refetchOnWindowFocus`. Optional later: `employeeModeAvailableAt` on `me`.
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthModeProvider } from "@/auth";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { AppPendingShell } from "@/components/AppPendingShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessLayout from "@/layouts/BusinessLayout";
import CustomerLayout from "@/layouts/CustomerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import BusinessHomePage from "@/pages/business/BusinessHomePage";
import PublicLayout from "@/layouts/PublicLayout";
import AccessDenied from "@/pages/AccessDenied";
import CustomerHomePage from "@/pages/customer/CustomerHomePage";
import EmployeeHomePage from "@/pages/employee/EmployeeHomePage";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const BusinessRegisterPage = lazy(() => import("@/pages/business/BusinessRegisterPage"));
const BusinessDashboardPage = lazy(() => import("@/pages/business/BusinessDashboardPage"));
const ChooseEmployeeModePage = lazy(() => import("@/pages/ChooseEmployeeModePage"));
const PostLoginPage = lazy(() => import("@/pages/customer/PostLoginPage"));
const UserCustomerProfilePage = lazy(() => import("@/pages/customer/UserCustomerProfilePage"));
const UserCustomerFavoritesPage = lazy(() => import("@/pages/customer/UserCustomerFavoritesPage"));
const UserCustomerDashboardPage = lazy(() => import("@/pages/customer/UserCustomerDashboardPage"));
const BusinessTenantProfilePage = lazy(() => import("@/pages/business/BusinessTenantProfilePage"));
const BusinessTenantFavoritesPage = lazy(() => import("@/pages/business/BusinessTenantFavoritesPage"));
import {
  canonicalBusinessDashboardPath,
  canonicalUserCustomerPath,
} from "@/routes/sessionPathGuards";
import {
  BusinessIdRouteGuard,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireBusinessSession,
  RequireEmployeeAuthMode,
  RequireUserSession,
  SessionLoading,
  UserIdRouteGuard,
} from "@/routes/AuthRouteGuards";

/**
 * Legacy `/app` → tenant dashboard for business sessions; **`/:userId/customer`** for user sessions
 * (Phase 2.5.3 — deprecate generic `/app` in favor of canonical paths).
 */
function LegacyAppRedirect() {
  const { state } = useAuth();
  if (!state.user) {
    return <Navigate to="/login" replace />;
  }
  if (state.user.type === "business") {
    return <Navigate to={canonicalBusinessDashboardPath(state.user)} replace />;
  }
  return <Navigate to={canonicalUserCustomerPath(state.user)} replace />;
}

function UserCustomerShell() {
  return (
    <ProtectedRoute>
      <RequireUserSession>
        <UserIdRouteGuard>
          <CustomerLayout />
        </UserIdRouteGuard>
      </RequireUserSession>
    </ProtectedRoute>
  );
}

function UserEmployeeShell() {
  return (
    <ProtectedRoute>
      <RequireUserSession>
        <UserIdRouteGuard>
          <RequireEmployeeAuthMode>
            <EmployeeLayout />
          </RequireEmployeeAuthMode>
        </UserIdRouteGuard>
      </RequireUserSession>
    </ProtectedRoute>
  );
}

/** Logged-in users hitting an unknown URL land on the same destination as after login (Phase 2.6.1). */
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

/** Route tree only — use with `BrowserRouter` (production) or `MemoryRouter` (tests). */
export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppPendingShell variant="route" />}>
    <Routes>
      {/* 1 — Public marketing & auth: nested under `/` + PublicLayout (Phase 1.4) */}
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

      {/* Static before `/:userId/*` so paths like `/access-denied` are not parsed as a user id */}
      <Route path="/access-denied" element={<AccessDenied />} />

      {/* 2 — Tenant shell */}
      <Route
        path="/business/:businessId"
        element={
          <ProtectedRoute>
            <RequireBusinessSession>
              <BusinessIdRouteGuard>
                <BusinessLayout />
              </BusinessIdRouteGuard>
            </RequireBusinessSession>
          </ProtectedRoute>
        }
      >
        <Route index element={<BusinessDashboardPage />} />
        <Route path="profile" element={<BusinessTenantProfilePage />} />
        <Route path="favorites" element={<BusinessTenantFavoritesPage />} />
      </Route>

      {/* 3 — User shell (after static paths so e.g. /login is not captured as :userId) */}
      <Route
        path="/:userId/mode"
        element={
          <ProtectedRoute>
            <RequireUserSession>
              <UserIdRouteGuard>
                <ChooseEmployeeModePage />
              </UserIdRouteGuard>
            </RequireUserSession>
          </ProtectedRoute>
        }
      />
      <Route path="/:userId/customer" element={<UserCustomerShell />}>
        <Route index element={<PostLoginPage />} />
        <Route path="profile" element={<UserCustomerProfilePage />} />
        <Route path="favorites" element={<UserCustomerFavoritesPage />} />
        <Route path="dashboard" element={<UserCustomerDashboardPage />} />
      </Route>
      <Route path="/:userId/employee" element={<UserEmployeeShell />}>
        <Route index element={<EmployeeHomePage />} />
      </Route>

      {/* Legacy */}
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

function App() {
  return (
    <BrowserRouter>
      <AuthModeProvider>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <AppRoutes />
        </div>
      </AuthModeProvider>
    </BrowserRouter>
  );
}

export default App;
