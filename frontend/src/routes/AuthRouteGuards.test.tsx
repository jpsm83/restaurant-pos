import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "./AuthRouteGuards";

const mockUseAuth = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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

  it("redirects authenticated users away from /login to /", () => {
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
          <Route path="/" element={<div>Home page</div>} />
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

    expect(screen.getByText("Home page")).toBeInTheDocument();
  });
});
