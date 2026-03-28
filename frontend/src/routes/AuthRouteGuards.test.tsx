import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_DENIED_PATH,
  BusinessIdRouteGuard,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireBusinessSession,
  RequireEmployeeAuthMode,
  RequireUserSession,
  UserIdRouteGuard,
} from "./AuthRouteGuards";

const mockUseAuth = vi.fn();
const mockUseAuthMode = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/AuthModeContext", () => ({
  useAuthMode: () => mockUseAuthMode(),
}));

describe("Auth route guards", () => {
  it("redirects unauthenticated users from protected route to /login", () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    render(
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

  it("redirects authenticated users away from /login to canonical user shell", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/u1/customer" element={<div>User customer shell</div>} />
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

  it("sends business session to access-denied from RequireUserSession", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "b1",
          email: "biz@test.local",
          type: "business",
        },
        error: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/only-user"]}>
        <Routes>
          <Route
            path={ACCESS_DENIED_PATH}
            element={<div>Access denied page</div>}
          />
          <Route
            path="/only-user"
            element={
              <RequireUserSession>
                <div>User area</div>
              </RequireUserSession>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Access denied page")).toBeInTheDocument();
  });

  it("sends user session to access-denied from RequireBusinessSession", () => {
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

    render(
      <MemoryRouter initialEntries={["/only-business"]}>
        <Routes>
          <Route
            path={ACCESS_DENIED_PATH}
            element={<div>Access denied page</div>}
          />
          <Route
            path="/only-business"
            element={
              <RequireBusinessSession>
                <div>Business area</div>
              </RequireBusinessSession>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Access denied page")).toBeInTheDocument();
  });

  it("UserIdRouteGuard redirects when :userId does not match session id", () => {
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

    render(
      <MemoryRouter initialEntries={["/wrong-user/customer"]}>
        <Routes>
          <Route
            path="/u1/customer"
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

  it("BusinessIdRouteGuard redirects when :businessId does not match session id", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "b1",
          email: "biz@test.local",
          type: "business",
        },
        error: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/business/wrong-tenant"]}>
        <Routes>
          <Route
            path="/business/b1"
            element={<div>Canonical business shell</div>}
          />
          <Route
            path="/business/:businessId"
            element={
              <BusinessIdRouteGuard>
                <div>Protected tenant</div>
              </BusinessIdRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Canonical business shell")).toBeInTheDocument();
    expect(screen.queryByText("Protected tenant")).not.toBeInTheDocument();
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

    it("redirects to /:userId/mode when auth_mode is customer", () => {
      mockUseAuthMode.mockReturnValue({
        mode: "customer",
        isLoading: false,
        isError: false,
      });

      render(
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

    it("redirects to /:userId/mode when mode fetch errors", () => {
      mockUseAuthMode.mockReturnValue({
        mode: undefined,
        isLoading: false,
        isError: true,
      });

      render(
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

    it("renders children when auth_mode is employee", () => {
      mockUseAuthMode.mockReturnValue({
        mode: "employee",
        isLoading: false,
        isError: false,
      });

      render(
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

    it("shows session loading while auth mode is loading", () => {
      mockUseAuthMode.mockReturnValue({
        mode: undefined,
        isLoading: true,
        isError: false,
      });

      render(
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
