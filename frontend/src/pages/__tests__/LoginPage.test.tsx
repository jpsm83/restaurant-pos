import type { ComponentPropsWithoutRef } from "react";
import { screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NAMESPACES } from "@/i18n/config";
import { buildLocaleResources } from "@/i18n/localeResources";
import { renderWithI18n } from "@/test/i18nTestUtils";
import LoginPage from "../LoginPage";

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../i18n/locales/*/*.json",
  { eager: true },
);

const mockDispatch = vi.fn();
const mockLogin = vi.fn();
const mockGoogleAuth = vi.fn();
const mockUseAuthConfigQuery = vi.fn();

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({
    onSuccess,
    onError,
    locale,
    containerProps,
  }: {
    onSuccess: (response: { credential?: string }) => void;
    onError: () => void;
    locale?: string;
    containerProps?: ComponentPropsWithoutRef<"div">;
  }) => (
    <div
      data-testid="google-widget"
      data-locale={locale}
      {...containerProps}
    >
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
  useAuthConfigQuery: (...args: unknown[]) =>
    mockUseAuthConfigQuery(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogin.mockReset();
    mockGoogleAuth.mockReset();
    mockUseAuthConfigQuery.mockReset();
    mockUseAuthConfigQuery.mockReturnValue({
      data: { googleSignInEnabled: true },
    });
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
      <MemoryRouter
        initialEntries={[
          "/login?returnTo=%2F64a1b2c3d4e5f67890123456%2Fcustomer%2Ffavorites",
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer/favorites"
            element={<div>Google favorites</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Google favorites")).toBeInTheDocument();
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

  it("maps a Google email conflict to its dedicated copy", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.conflict",
        status: 409,
        serverMessage: "This email is linked to a different Google account.",
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
        "This email address is linked to a different Google account. Use email and password, or sign in with the correct Google account.",
      ),
    ).toBeInTheDocument();
  });

  it("maps a Google email conflict to Spanish copy", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.conflict",
        status: 409,
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
        "Esta dirección de correo está vinculada a una cuenta de Google diferente. Usa el correo y la contraseña, o inicia sesión con la cuenta de Google correcta.",
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

  it("hides the Google button while the auth config loads", async () => {
    mockUseAuthConfigQuery.mockReturnValue({ data: undefined });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });

  it("treats a failed auth config request as Google disabled", async () => {
    mockUseAuthConfigQuery.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("config unavailable"),
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("hides the Google button when the server reports it disabled", async () => {
    mockUseAuthConfigQuery.mockReturnValue({
      data: { googleSignInEnabled: false },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });

  it("passes the active language to the Google widget", async () => {
    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
      { language: "es" },
    );

    expect(screen.getByTestId("google-widget")).toHaveAttribute(
      "data-locale",
      "es",
    );
  });

  it("omits the Google widget locale when the language is unsupported", async () => {
    const resources = buildLocaleResources(localeModules, NAMESPACES);
    resources.fr = resources.en;
    const instance = i18next.createInstance();
    instance.use(initReactI18next);
    await instance.init({
      lng: "fr",
      fallbackLng: "en",
      supportedLngs: ["en", "es", "fr"],
      resources,
      ns: [...NAMESPACES],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
      { i18n: instance },
    );

    expect(screen.getByTestId("google-widget")).not.toHaveAttribute(
      "data-locale",
    );
  });

  it("disables the Google control and ignores a second attempt while busy", async () => {
    const user = userEvent.setup();
    let resolveGoogleAuth: (value: unknown) => void = () => {};
    mockGoogleAuth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGoogleAuth = resolve;
        }),
    );

    await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const widget = screen.getByTestId("google-widget");
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    await user.click(googleButton);

    await waitFor(() => {
      expect(widget).toHaveAttribute("aria-disabled", "true");
      expect(widget).toHaveAttribute("inert");
    });

    await user.click(googleButton);
    expect(mockGoogleAuth).toHaveBeenCalledTimes(1);

    resolveGoogleAuth({
      ok: false,
      error: {
        code: "googleAuth.unauthorized",
        status: 401,
        fieldErrors: [],
      },
    });

    await waitFor(() => {
      expect(widget).toHaveAttribute("aria-disabled", "false");
    });
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

  it("honours a safe returnTo after email login", async () => {
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
      <MemoryRouter
        initialEntries={[
          "/login?returnTo=%2F64a1b2c3d4e5f67890123456%2Fcustomer%2Ffavorites%3Ftab%3Dall",
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer/favorites"
            element={<div>Returned favorites</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "patron@example.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Returned favorites")).toBeInTheDocument();
    });
  });

  it("falls back to the Customer dashboard for an unsafe returnTo", async () => {
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
      <MemoryRouter
        initialEntries={["/login?returnTo=https%3A%2F%2Fevil.example"]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:userId/customer/dashboard"
            element={<div>Safe customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "patron@example.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Safe customer dashboard")).toBeInTheDocument();
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
