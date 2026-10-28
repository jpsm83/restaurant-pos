import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import LoginPage from "../LoginPage";

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

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/auth/api", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogin.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("shows required validation when form is empty", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const requiredMsgs = screen.getAllByText(
      "Email and password are required.",
    );
    // The form shows the required message for both empty `email` and `password`.
    expect(requiredMsgs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders forgot password link to recovery route", async () => {
    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const forgotPasswordLink = screen.getByRole("link", {
      name: /forgot password\?/i,
    });
    expect(forgotPasswordLink).toHaveAttribute("href", "/forgot-password");
  });

  it("shows a flash message passed through navigation state", async () => {
    await renderWithI18n(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: { flashMessage: "Your sign-in email has been updated." },
          },
        ]}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Your sign-in email has been updated."),
    ).toBeInTheDocument();
  });

  it("shows localized copy on failed login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: false,
      error: {
        code: "signIn.unauthorized",
        status: 401,
        message: "Invalid credentials",
        serverMessage: "Invalid credentials",
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "john@doe.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText("The email or password is incorrect."),
    ).toBeInTheDocument();
  });

  it("renders the sign-in failure in Spanish", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: false,
      error: {
        code: "signIn.unauthorized",
        status: 401,
        serverMessage: "Invalid credentials",
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
      { language: "es" },
    );

    await user.type(screen.getByLabelText(/correo electrónico/i), "john@doe.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(
      screen.getByText("El correo o la contraseña no son correctos."),
    ).toBeInTheDocument();
  });

  it("explains an unreachable server in the active language", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: false,
      error: {
        code: "signIn.transport",
        serverMessage: "Failed to fetch",
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "john@doe.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText(
        "We could not reach the server. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps an owner on the Customer dashboard after login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "507f1f77bcf86cd799439011",
          email: "owner@restaurant.com",
          type: "user",
          mode: "customer",
          role: "Customer",
        },
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer/dashboard"
            element={<div>Customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "owner@restaurant.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Customer dashboard")).toBeInTheDocument();
    });
  });

  it("navigates to /:userId/customer/dashboard after user login without employee", async () => {
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

    await renderWithI18n(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer/dashboard"
            element={<div>User customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "patron@example.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("User customer dashboard")).toBeInTheDocument();
    });
  });
});
