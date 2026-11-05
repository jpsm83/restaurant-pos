import type { ComponentPropsWithoutRef } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { renderWithI18n } from "@/test/i18nTestUtils";
import SignUpPage from "../SignUpPage";

const mockDispatch = vi.fn();
const mockSignup = vi.fn();
const mockGoogleAuth = vi.fn();
const mockUseAuthConfigQuery = vi.fn();
const mockResendEmailConfirmation = vi.fn();

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
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/auth/api", () => ({
  signup: (...args: unknown[]) => mockSignup(...args),
  googleAuth: (...args: unknown[]) => mockGoogleAuth(...args),
  resendEmailConfirmation: (...args: unknown[]) =>
    mockResendEmailConfirmation(...args),
  useAuthConfigQuery: (...args: unknown[]) =>
    mockUseAuthConfigQuery(...args),
}));

const googleSignupUser = {
  id: "64a1b2c3d4e5f67890123456",
  email: "google-new@example.com",
  type: "user",
  emailVerified: true,
};

const emailSignupUser = {
  id: "64a1b2c3d4e5f67890123456",
  email: "new@example.com",
  type: "user",
};

const googleSignupSuccess = {
  ok: true,
  data: { user: googleSignupUser },
} as const;

function mockGoogleSignupSuccess() {
  mockGoogleAuth.mockResolvedValue(googleSignupSuccess);
}

function mockEmailSignupSuccess(user = emailSignupUser) {
  mockSignup.mockResolvedValue({
    ok: true,
    data: { user },
  });
}

describe("SignUpPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockSignup.mockReset();
    mockGoogleAuth.mockReset();
    mockUseAuthConfigQuery.mockReset();
    mockResendEmailConfirmation.mockReset();
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.warning).mockClear();
    mockUseAuthConfigQuery.mockReturnValue({
      data: { googleSignInEnabled: true },
    });
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id");
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows validation when fields are empty", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /create account$/i }));

    const requiredMsgs = screen.getAllByText(
      "Email, password and confirm password are required.",
    );
    expect(requiredMsgs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows mismatch error when passwords differ", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "a@b.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "OtherPass2!");
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    expect(
      screen.getByText("Password and confirm password must match."),
    ).toBeInTheDocument();
  });

  it("requires privacy/terms acceptance and keeps typed credentials", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "keep@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    expect(
      screen.getByText(
        "Accept the privacy notice and account terms to create an account.",
      ),
    ).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^email$/i)).toHaveValue("keep@example.com");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("ValidPass1!");
  });

  it("renders the legal acceptance links as safe new-tab links", async () => {
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    const privacyLink = screen.getByRole("link", { name: /privacy notice/i });
    expect(privacyLink).toHaveAttribute("href", "/legal/privacy");
    expect(privacyLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");

    const termsLink = screen.getByRole("link", { name: /account terms/i });
    expect(termsLink).toHaveAttribute("href", "/legal/terms");
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the legal acceptance links in Spanish", async () => {
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
      { language: "es" },
    );

    expect(
      screen.getByRole("link", { name: /aviso de privacidad/i }),
    ).toHaveAttribute("href", "/legal/privacy");
    expect(
      screen.getByRole("link", { name: /términos de la cuenta/i }),
    ).toHaveAttribute("href", "/legal/terms");
  });

  it.each([
    { name: "privacy notice", linkName: /privacy notice/i },
    { name: "account terms", linkName: /account terms/i },
  ])("does not accept the terms when the $name link is clicked", async ({ linkName }) => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /privacy notice and account terms/i,
    });
    const link = screen.getByRole("link", { name: linkName });

    expect(checkbox).not.toBeChecked();
    await user.click(link);
    expect(checkbox).not.toBeChecked();
  });

  it("shows the acceptance validation in Spanish", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
      { language: "es" },
    );

    await user.type(
      screen.getByLabelText(/^correo electrónico$/i),
      "sinaceptar@example.com",
    );
    await user.type(screen.getByLabelText(/^contraseña$/i), "ValidPass1!");
    await user.type(
      screen.getByLabelText(/confirmar contraseña/i),
      "ValidPass1!",
    );
    await user.click(screen.getByRole("button", { name: /crear cuenta$/i }));

    expect(
      screen.getByText(
        "Debes aceptar el aviso de privacidad y los términos de la cuenta para crear una cuenta.",
      ),
    ).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("sends the acceptance proof with an accepted sign-up", async () => {
    const user = userEvent.setup();
    mockEmailSignupSuccess({
      ...emailSignupUser,
      email: "accepted@example.com",
    });

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "accepted@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith({
        email: "accepted@example.com",
        password: "ValidPass1!",
        privacyAccepted: true,
        languagePreference: "en",
      });
    });
  });

  it("shows API error when signup fails", async () => {
    const user = userEvent.setup();
    mockSignup.mockResolvedValue({
      ok: false,
      error: {
        code: "signUp.conflict",
        status: 409,
        message: "Email taken",
        serverMessage: "Email taken",
        fieldErrors: [],
      },
    });

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(
      screen.getByText(
        "That email address is already used by another account.",
      ),
    ).toBeInTheDocument();
    });
  });

  it("warns locally and offers a resend when the verification email fails", async () => {
    const user = userEvent.setup();
    mockSignup.mockResolvedValue({
      ok: true,
      data: { user: emailSignupUser, verificationEmailSent: false },
    });
    mockResendEmailConfirmation.mockResolvedValue({
      ok: true,
      data: { message: "" },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/dashboard" element={<div>Customer dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledTimes(1);
    });

    const [message, options] = vi.mocked(toast.warning).mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe(
      "Your account was created, but we couldn't send the confirmation email.",
    );
    expect(options.action.label).toBe("Resend email");
    expect(toast.info).not.toHaveBeenCalled();
    expect(screen.getByText("Customer dashboard")).toBeInTheDocument();

    options.action.onClick();

    await waitFor(() => {
      expect(mockResendEmailConfirmation).toHaveBeenCalledTimes(1);
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Confirmation email sent. Check your inbox.",
    );
  });

  it("shows reactivation guidance when signup targets a soft-deleted account", async () => {
    const user = userEvent.setup();
    mockSignup.mockResolvedValue({
      ok: true,
      data: { user: null, reactivationRequired: true },
    });

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "deleted@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "Account reactivation required. Please confirm the email link we sent to reactivate this account.",
      );
    });
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "AUTH_ERROR" }),
    );
  });

  it("shows generic guidance when signup matches an existing account", async () => {
    const user = userEvent.setup();
    mockSignup.mockResolvedValue({
      ok: true,
      data: { user: null, reactivationRequired: false },
    });

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "exists@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "If this account needs email verification, you will receive a message shortly.",
      );
    });
  });

  it("passes the active language to email signup", async () => {
    const user = userEvent.setup();
    mockEmailSignupSuccess({
      ...emailSignupUser,
      email: "nuevo@example.com",
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={<div>Customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
      { language: "es" },
    );

    await user.type(
      screen.getByLabelText(/^correo electrónico$/i),
      "nuevo@example.com",
    );
    await user.type(
      screen.getByLabelText(/^contraseña$/i),
      "ValidPass1!",
    );
    await user.type(
      screen.getByLabelText(/confirmar contraseña/i),
      "ValidPass1!",
    );
    await user.click(
      screen.getByLabelText(/aviso de privacidad y los términos de la cuenta/i),
    );
    await user.click(
      screen.getByRole("button", { name: /crear cuenta$/i }),
    );

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith({
        email: "nuevo@example.com",
        password: "ValidPass1!",
        privacyAccepted: true,
        languagePreference: "es",
      });
    });
  });

  it("signs up through the shared Google entry path", async () => {
    const user = userEvent.setup();
    mockGoogleSignupSuccess();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={<div>Google customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Google customer dashboard")).toBeInTheDocument();
    });
    expect(mockGoogleAuth).toHaveBeenCalledWith({
      credential: "google-id-token",
      intent: "signup",
      privacyAccepted: true,
      languagePreference: "en",
    });
  });

  it("refuses Google sign-up while the acceptance checkbox is unchecked", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    const widget = screen.getByTestId("google-widget");
    expect(widget).toHaveAttribute("aria-disabled", "true");
    expect(widget).toHaveAttribute("inert");

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(
      await screen.findByText(
        "Accept the privacy notice and account terms to create an account.",
      ),
    ).toBeInTheDocument();
    expect(mockGoogleAuth).not.toHaveBeenCalled();
  });

  it("surfaces the acceptance validation from the blocked Google overlay", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /accept the required terms to enable google sign-up/i,
      }),
    );

    expect(
      await screen.findByText(
        "Accept the privacy notice and account terms to create an account.",
      ),
    ).toBeInTheDocument();
    expect(mockGoogleAuth).not.toHaveBeenCalled();
  });

  it("enables the Google control once acceptance is checked", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    const widget = screen.getByTestId("google-widget");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );

    expect(widget).not.toHaveAttribute("aria-disabled", "true");
    expect(widget).not.toHaveAttribute("inert");
  });

  it("maps a Google email conflict to its dedicated copy", async () => {
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
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
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

  it("hides the Google button when no client id is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
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
        <SignUpPage />
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
        <SignUpPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account$/i })).toBeEnabled();
  });

  it("hides the Google button when the server reports it disabled", async () => {
    mockUseAuthConfigQuery.mockReturnValue({
      data: { googleSignInEnabled: false },
    });

    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });

  it("passes the active language to the Google widget", async () => {
    await renderWithI18n(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
      { language: "es" },
    );

    expect(screen.getByTestId("google-widget")).toHaveAttribute(
      "data-locale",
      "es",
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
        <SignUpPage />
      </MemoryRouter>,
    );

    const widget = screen.getByTestId("google-widget");
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
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

  it.each([
    {
      name: "honours a safe returnTo after email signup",
      method: "email" as const,
      returnTo: "/favorites",
      path: "/favorites",
      landing: "Signup favorites",
    },
    {
      name: "falls back to the Customer dashboard for an unsafe returnTo after email signup",
      method: "email" as const,
      returnTo: "https://evil.example",
      path: "/dashboard",
      landing: "Safe signup dashboard",
    },
    {
      name: "honours a safe returnTo after Google signup",
      method: "google" as const,
      returnTo: "/favorites?tab=all",
      path: "/favorites",
      landing: "Google signup favorites",
    },
    {
      name: "falls back to the Customer dashboard for an unsafe returnTo after Google signup",
      method: "google" as const,
      returnTo: "https://evil.example",
      path: "/dashboard",
      landing: "Safe Google dashboard",
    },
  ])("$name", async ({ method, returnTo, path, landing }) => {
    const user = userEvent.setup();
    if (method === "email") mockEmailSignupSuccess();
    else mockGoogleSignupSuccess();

    await renderWithI18n(
      <MemoryRouter
        initialEntries={[
          `/signup?returnTo=${encodeURIComponent(returnTo)}`,
        ]}
      >
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path={path} element={<div>{landing}</div>} />
        </Routes>
      </MemoryRouter>,
    );

    if (method === "email") {
      await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
      await user.type(
        screen.getByLabelText(/confirm password/i),
        "ValidPass1!",
      );
      await user.click(
        screen.getByLabelText(/privacy notice and account terms/i),
      );
      await user.click(
        screen.getByRole("button", { name: /create account$/i }),
      );
    } else {
      await user.click(
        screen.getByLabelText(/privacy notice and account terms/i),
      );
      await user.click(
        screen.getByRole("button", { name: /continue with google/i }),
      );
    }

    await waitFor(() => {
      expect(screen.getByText(landing)).toBeInTheDocument();
    });
  });

  it("navigates to customer dashboard after successful user signup", async () => {
    const user = userEvent.setup();
    mockEmailSignupSuccess();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={<div>Customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(
      screen.getByLabelText(/privacy notice and account terms/i),
    );
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(screen.getByText("Customer dashboard")).toBeInTheDocument();
    });
  });

  it.each([
    {
      name: "preserves a safe returnTo on the back to sign in link",
      entry: "/signup?returnTo=%2Faccount%2Fprofile",
      expectedHref: "/login?returnTo=%2Faccount%2Fprofile",
    },
    {
      name: "keeps a plain back to sign in link without returnTo",
      entry: "/signup",
      expectedHref: "/login",
    },
    {
      name: "drops an unsafe returnTo from the back to sign in link",
      entry: "/signup?returnTo=https%3A%2F%2Fevil.example",
      expectedHref: "/login",
    },
  ])("$name", async ({ entry, expectedHref }) => {
    await renderWithI18n(
      <MemoryRouter initialEntries={[entry]}>
        <SignUpPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /back to sign in/i }),
    ).toHaveAttribute("href", expectedHref);
    expect(
      screen.queryByRole("button", { name: /back to sign in/i }),
    ).not.toBeInTheDocument();
  });
});
