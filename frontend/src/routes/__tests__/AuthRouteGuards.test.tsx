/**
 * Tests for `AuthRouteGuards.tsx` — guards in isolation with mocked `useAuth` / `useAuthMode`.
 * For full route integration, see `App.routing.test.tsx` and page-level tests.
 */
import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import {
  BusinessRouteShell,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireEmployeeAuthMode,
  UserIdRouteGuard,
} from "../AuthRouteGuards";

function LocationProbe() {
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get("returnTo");
  return (
    <div data-testid="location">
      {location.pathname}|{returnTo ?? ""}
    </div>
  );
}

const mockUseAuth = vi.fn();
const mockUseAuthMode = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/AuthModeContext", () => ({
  useAuthMode: () => mockUseAuthMode(),
}));

describe("Auth route guards", () => {
  it("redirects unauthenticated users from protected route to /login", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("sends anonymous users to shared login with a safe returnTo", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/u1/customer/favorites?tab=all"]}
      >
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route
            path="/u1/customer/favorites"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/login|/u1/customer/favorites?tab=all",
    );
  });

  it("redirects authenticated users away from /login to canonical user shell", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/u1/customer/dashboard" element={<div>User customer shell</div>} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>Login page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("User customer shell")).toBeInTheDocument();
  });

  it("honours a safe returnTo when an authenticated user leaves a public-only route", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={[
          "/login?returnTo=%2Fu1%2Fcustomer%2Ffavorites%3Ftab%3Dall",
        ]}
      >
        <Routes>
          <Route path="/u1/customer/favorites" element={<div>Favorites</div>} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>Login page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("falls back to the Customer dashboard for an unsafe returnTo", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/signup?returnTo=https%3A%2F%2Fevil.example"]}
      >
        <Routes>
          <Route
            path="/u1/customer/dashboard"
            element={<div>Customer dashboard</div>}
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <div>Signup page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Customer dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Signup page")).not.toBeInTheDocument();
  });

  it("BusinessRouteShell redirects anonymous visitors to /login", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("BusinessRouteShell renders venue pages for an authenticated User", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "u1",
          email: "john@doe.com",
          type: "user",
        },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Venue page")).toBeInTheDocument();
  });

  it("UserIdRouteGuard redirects when :userId does not match session id", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "u1",
          email: "john@doe.com",
          type: "user",
        },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/wrong-user/customer"]}>
        <Routes>
          <Route
            path="/u1/customer/dashboard"
            element={<div>Canonical user shell</div>}
          />
          <Route
            path="/:userId/customer"
            element={
              <UserIdRouteGuard>
                <div>Protected customer</div>
              </UserIdRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Canonical user shell")).toBeInTheDocument();
    expect(screen.queryByText("Protected customer")).not.toBeInTheDocument();
  });

  describe("RequireEmployeeAuthMode (Phase 3.5)", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        state: {
          status: "authenticated",
          user: { id: "u1", email: "john@doe.com", type: "user" },
          error: null,
        },
      });
      mockUseAuthMode.mockReset();
    });

    it("redirects to /:userId/mode when session mode is customer", async () => {
      mockUseAuthMode.mockReturnValue({
        mode: "customer",
        isLoading: false,
        isError: false,
      });

      await renderWithI18n(
        <MemoryRouter initialEntries={["/u1/employee"]}>
          <Routes>
            <Route path="/u1/mode" element={<div>Mode picker</div>} />
            <Route
              path="/:userId/employee"
              element={
                <RequireEmployeeAuthMode>
                  <div>Employee shell</div>
                </RequireEmployeeAuthMode>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Mode picker")).toBeInTheDocument();
      expect(screen.queryByText("Employee shell")).not.toBeInTheDocument();
    });

    it("redirects to /:userId/mode when mode fetch errors", async () => {
      mockUseAuthMode.mockReturnValue({
        mode: undefined,
        isLoading: false,
        isError: true,
      });

      await renderWithI18n(
        <MemoryRouter initialEntries={["/u1/employee"]}>
          <Routes>
            <Route path="/u1/mode" element={<div>Mode picker</div>} />
            <Route
              path="/:userId/employee"
              element={
                <RequireEmployeeAuthMode>
                  <div>Employee shell</div>
                </RequireEmployeeAuthMode>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Mode picker")).toBeInTheDocument();
    });

    it("renders children when session mode is business", async () => {
      mockUseAuthMode.mockReturnValue({
        mode: "business",
        isLoading: false,
        isError: false,
      });

      await renderWithI18n(
        <MemoryRouter initialEntries={["/u1/employee"]}>
          <Routes>
            <Route path="/u1/mode" element={<div>Mode picker</div>} />
            <Route
              path="/:userId/employee"
              element={
                <RequireEmployeeAuthMode>
                  <div>Employee shell</div>
                </RequireEmployeeAuthMode>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Employee shell")).toBeInTheDocument();
      expect(screen.queryByText("Mode picker")).not.toBeInTheDocument();
    });

    it("shows session loading while auth mode is loading", async () => {
      mockUseAuthMode.mockReturnValue({
        mode: undefined,
        isLoading: true,
        isError: false,
      });

      await renderWithI18n(
        <MemoryRouter initialEntries={["/u1/employee"]}>
          <Routes>
            <Route path="/u1/mode" element={<div>Mode picker</div>} />
            <Route
              path="/:userId/employee"
              element={
                <RequireEmployeeAuthMode>
                  <div>Employee shell</div>
                </RequireEmployeeAuthMode>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText(/checking workspace mode/i)).toBeInTheDocument();
    });
  });
});
