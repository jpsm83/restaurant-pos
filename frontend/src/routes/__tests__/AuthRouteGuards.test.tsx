/**
 * Tests for `AuthRouteGuards.tsx` — guards in isolation with mocked `useAuth`.
 * For full route integration, see `App.routing.test.tsx` and page-level tests.
 */
import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import {
  BusinessRouteShell,
  ProtectedRoute,
  PublicOnlyRoute,
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

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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
        initialEntries={["/favorites?tab=all"]}
      >
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route
            path="/favorites"
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
      "/login|/favorites?tab=all",
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
          <Route path="/dashboard" element={<div>User customer shell</div>} />
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
          "/login?returnTo=%2Ffavorites%3Ftab%3Dall",
        ]}
      >
        <Routes>
          <Route path="/favorites" element={<div>Favorites</div>} />
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
            path="/dashboard"
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
});
