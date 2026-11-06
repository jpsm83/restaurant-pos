import type { ComponentPropsWithoutRef } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NAMESPACES } from "@/i18n/config";
import { buildLocaleResources } from "@/i18n/localeResources";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { SiteAudienceProvider } from "@/context/SiteAudienceContext";
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
    width,
    containerProps,
  }: {
    onSuccess: (response: { credential?: string }) => void;
    onError: () => void;
    locale?: string;
    width?: number;
    containerProps?: ComponentPropsWithoutRef<"div">;
  }) => (
    <div
      data-testid="google-widget"
      data-locale={locale}
      data-width={width}
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

const googleLoginUser = {
  id: "64a1b2c3d4e5f67890123456",
  email: "google@example.com",
  type: "user",
  emailVerified: true,
};

const googleLoginSuccess = {
  ok: true,
  data: { user: googleLoginUser },
} as const;

function mockGoogleLoginSuccess() {
  mockGoogleAuth.mockResolvedValue(googleLoginSuccess);
}

function mockMeasuredWidth(width: number | (() => number)) {
  const readWidth = typeof width === "function" ? width : () => width;
  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(() => {
      const measured = readWidth();
      return {
        width: measured,
        height: 0,
        top: 0,
        left: 0,
        right: measured,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    vi.mocked(toast.info).mockClear();
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
    vi.restoreAllMocks();
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

  it.each([
    {
      name: "preserves a safe returnTo on the create account link",
      entry: "/login?returnTo=%2Ffavorites%3Ftab%3Dall",
      expectedHref: "/signup?returnTo=%2Ffavorites%3Ftab%3Dall",
    },
    {
      name: "keeps a plain create account link without returnTo",
      entry: "/login",
      expectedHref: "/signup",
    },
    {
      name: "drops an unsafe returnTo from the create account link",
      entry: "/login?returnTo=https%3A%2F%2Fevil.example",
      expectedHref: "/signup",
    },
  ])("$name", async ({ entry, expectedHref }) => {
    await renderWithI18n(
      <MemoryRouter initialEntries={[entry]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /create account/i }),
    ).toHaveAttribute("href", expectedHref);
    expect(
      screen.queryByRole("button", { name: /create account/i }),
    ).not.toBeInTheDocument();
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

  it.each([
    {
      name: "signs in through the shared Google entry path",
      returnTo: "/favorites",
      path: "/favorites",
      landing: "Google favorites",
    },
    {
      name: "falls back to the Customer dashboard for an unsafe Google returnTo",
      returnTo: "https://evil.example",
      path: "/dashboard",
      landing: "Safe Google dashboard",
    },
  ])("$name", async ({ returnTo, path, landing }) => {
    const user = userEvent.setup();
    mockGoogleLoginSuccess();

    await renderWithI18n(
      <MemoryRouter
        initialEntries={[
          `/login?returnTo=${encodeURIComponent(returnTo)}`,
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path={path} element={<div>{landing}</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(landing)).toBeInTheDocument();
    });
    expect(mockGoogleAuth).toHaveBeenCalledWith({
      credential: "google-id-token",
      intent: "signin",
      languagePreference: "en",
    });
  });

  it("sends sign-in intent without acceptance", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.accountNotFound",
        status: 404,
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/login?returnTo=%2Ffavorites%3Ftab%3Dall"]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<div>Signup page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(mockGoogleAuth).toHaveBeenCalledWith({
        credential: "google-id-token",
        intent: "signin",
        languagePreference: "en",
      });
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the unknown-account toast with a sign-up action preserving returnTo", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.accountNotFound",
        status: 404,
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/login?returnTo=%2Ffavorites%3Ftab%3Dall"]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<div>Signup page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "No account is linked to this Google sign-in. Create an account to continue.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Create account" }),
        }),
      );
    });

    const options = vi.mocked(toast.info).mock.calls.at(-1)?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;
    await act(async () => {
      options?.action?.onClick?.();
    });

    expect(screen.getByText("Signup page")).toBeInTheDocument();
  });

  it("translates the unknown-account toast into Spanish", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "googleAuth.accountNotFound",
        status: 404,
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

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "No hay ninguna cuenta vinculada a este inicio de sesión con Google. Crea una cuenta para continuar.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Crear cuenta" }),
        }),
      );
    });
  });

  it.each([
    "googleAuth.unauthorized",
    "googleAuth.conflict",
    "googleAuth.rateLimited",
    "googleAuth.transport",
  ])(
    "keeps the on-page alert and no unknown-account toast for %s",
    async (code) => {
      const user = userEvent.setup();
      mockGoogleAuth.mockResolvedValue({
        ok: false,
        error: { code, status: 400, fieldErrors: [] },
      });

      await renderWithI18n(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>,
      );

      await user.click(
        screen.getByRole("button", { name: /continue with google/i }),
      );

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(toast.info).not.toHaveBeenCalled();
    },
  );

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

  it.each([
    { containerWidth: 280, expected: "280" },
    { containerWidth: 360, expected: "360" },
    { containerWidth: 600, expected: "400" },
  ])(
    "sizes the Google control to the available card width ($containerWidth)",
    async ({ containerWidth, expected }) => {
      mockMeasuredWidth(containerWidth);

      await renderWithI18n(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("google-widget")).toHaveAttribute(
        "data-width",
        expected,
      );
    },
  );

  it("sizes the Google control when the auth config resolves after mount", async () => {
    mockMeasuredWidth(360);
    let config: { data?: { googleSignInEnabled: boolean } } = {};
    mockUseAuthConfigQuery.mockImplementation(() => config);

    const view = await renderWithI18n(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("google-widget")).not.toBeInTheDocument();

    config = { data: { googleSignInEnabled: true } };
    view.rerender(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("google-widget")).toHaveAttribute(
      "data-width",
      "360",
    );
  });

  it("updates the Google control width when the container resizes", async () => {
    let currentWidth = 280;
    mockMeasuredWidth(() => currentWidth);

    const callbacks: ResizeObserverCallback[] = [];
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    try {
      await renderWithI18n(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>,
      );

      const widget = screen.getByTestId("google-widget");
      expect(widget).toHaveAttribute("data-width", "280");

      currentWidth = 620;
      await act(async () => {
        for (const callback of callbacks) {
          callback([], {} as ResizeObserver);
        }
      });

      expect(widget).toHaveAttribute("data-width", "400");
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
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
      expect(widget).not.toHaveAttribute("aria-disabled");
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
            path="/dashboard"
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
          "/login?returnTo=%2Ffavorites%3Ftab%3Dall",
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/favorites"
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
            path="/dashboard"
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

  it("keeps the Customer landing under the business marketing audience", async () => {
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
      <MemoryRouter initialEntries={["/business"]}>
        <SiteAudienceProvider>
          <Routes>
            <Route path="/business" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={<div>Audience-safe dashboard</div>}
            />
          </Routes>
        </SiteAudienceProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "owner@restaurant.com");
    await user.type(screen.getByLabelText(/password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Audience-safe dashboard")).toBeInTheDocument();
    });
  });

  it("navigates to /dashboard after user login without employee", async () => {
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
            path="/dashboard"
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
