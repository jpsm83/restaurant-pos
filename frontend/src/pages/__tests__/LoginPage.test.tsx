import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import LoginPage from "../LoginPage";

const mockDispatch = vi.fn();
const mockLogin = vi.fn();
const mockGoogleAuth = vi.fn();

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (response: { credential?: string }) => void;
    onError: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSuccess({ credential: "google-id-token" })}
      >
        Continue with Google
      </button>
      <button type="button" onClick={onError}>
        Fail Google
      </button>
    </div>
  ),
}));

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
  googleAuth: (...args: unknown[]) => mockGoogleAuth(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogin.mockReset();
    mockGoogleAuth.mockReset();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id");
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("signs in through the shared Google entry path", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "64a1b2c3d4e5f67890123456",
          email: "google@example.com",
          type: "user",
          emailVerified: true,
        },
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer/dashboard"
            element={<div>Google dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Google dashboard")).toBeInTheDocument();
    });
    expect(mockGoogleAuth).toHaveBeenCalledWith({
      credential: "google-id-token",
      languagePreference: "en",
    });
  });

  it("maps a Google failure to localized auth copy", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.unauthorized",
        status: 401,
        serverMessage: "Invalid Google credential",
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(
      await screen.findByText(
        "We couldn't sign you in with Google. Try again or use email and password.",
      ),
    ).toBeInTheDocument();
  });

  it("maps a Google failure to Spanish copy", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.unauthorized",
        status: 401,
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
      { language: "es" },
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(
      await screen.findByText(
        "No pudimos iniciar sesión con Google. Inténtalo de nuevo o usa el correo y la contraseña.",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces the soft-deleted reactivation outcome without an error", async () => {
    const user = userEvent.setup();
    vi.mocked(toast.info).mockClear();
    mockGoogleAuth.mockResolvedValue({
      ok: true,
      data: {
        user: null,
        reactivationRequired: true,
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "Account reactivation required. Please confirm the email link we sent to reactivate this account.",
      );
    });
    expect(
      screen.queryByText(
        "We couldn't sign you in with Google. Try again or use email and password.",
      ),
    ).not.toBeInTheDocument();
  });

  it("maps a Google provider error to localized auth copy", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /fail google/i }));

    expect(
      await screen.findByText(
        "We couldn't sign you in with Google. Try again or use email and password.",
      ),
    ).toBeInTheDocument();
    expect(mockGoogleAuth).not.toHaveBeenCalled();
  });

  it("hides the Google button when no client id is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
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
