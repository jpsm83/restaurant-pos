import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import SignUpPage from "../SignUpPage";

const mockDispatch = vi.fn();
const mockSignup = vi.fn();
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
  signup: (...args: unknown[]) => mockSignup(...args),
  googleAuth: (...args: unknown[]) => mockGoogleAuth(...args),
}));

describe("SignUpPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockSignup.mockReset();
    mockGoogleAuth.mockReset();
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
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(
      screen.getByText(
        "That email address is already used by another account.",
      ),
    ).toBeInTheDocument();
    });
  });

  it("signs up through the shared Google entry path", async () => {
    const user = userEvent.setup();
    mockGoogleAuth.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "64a1b2c3d4e5f67890123456",
          email: "google-new@example.com",
          type: "user",
          emailVerified: true,
        },
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/:userId/customer/dashboard"
            element={<div>Google customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Google customer dashboard")).toBeInTheDocument();
    });
    expect(mockGoogleAuth).toHaveBeenCalledWith({
      credential: "google-id-token",
      languagePreference: "en",
    });
  });

  it("maps a Google sign-up failure to localized auth copy", async () => {
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
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(
      await screen.findByText(
        "We couldn't sign you in with Google. Try again or use email and password.",
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

  it("navigates to customer dashboard after successful user signup", async () => {
    const user = userEvent.setup();
    mockSignup.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "64a1b2c3d4e5f67890123456",
          email: "new@example.com",
          type: "user",
        },
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/:userId/customer/dashboard"
            element={<div>Customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "ValidPass1!");
    await user.type(screen.getByLabelText(/confirm password/i), "ValidPass1!");
    await user.click(screen.getByRole("button", { name: /create account$/i }));

    await waitFor(() => {
      expect(screen.getByText("Customer dashboard")).toBeInTheDocument();
    });
  });
});
