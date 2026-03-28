import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";

const mockDispatch = vi.fn();
const mockLogin = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: null,
      status: "unauthenticated",
      error: null,
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth")>();
  return {
    ...actual,
    login: (...args: unknown[]) => mockLogin(...args),
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogin.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("shows required validation when form is empty", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText("Email and password are required."),
    ).toBeInTheDocument();
  });

  it("shows backend error on failed login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: false,
      error: "Invalid credentials",
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "john@doe.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("navigates to /business/:id after business login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "507f1f77bcf86cd799439011",
          email: "owner@restaurant.com",
          type: "business",
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/business/:businessId"
            element={<div>Business dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "owner@restaurant.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Business dashboard")).toBeInTheDocument();
    });
  });

  it("navigates to /:userId/customer after user login without employee", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "64a1b2c3d4e5f67890123456",
          email: "patron@example.com",
          type: "user",
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer"
            element={<div>User customer shell</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "patron@example.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("User customer shell")).toBeInTheDocument();
    });
  });
});
