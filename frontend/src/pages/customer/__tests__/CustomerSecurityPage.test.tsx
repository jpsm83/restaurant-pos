import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "@/i18n/format";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerSecurityPage from "../CustomerSecurityPage";

const mockGetUserProfile = vi.fn();
const mockResend = vi.fn();
const mockRequestEmailChange = vi.fn();
const toastSuccess = vi.fn();

const { mockResendPending } = vi.hoisted(() => ({
  mockResendPending: { value: false },
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      status: "authenticated",
      user: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        role: "Customer",
      },
      error: null,
    },
  }),
}));

vi.mock("@/auth/api", () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  requestEmailChange: (...args: unknown[]) => mockRequestEmailChange(...args),
}));

vi.mock("@/hooks/useResendEmailConfirmation", () => ({
  useResendEmailConfirmation: () => ({
    resend: mockResend,
    pending: mockResendPending.value,
  }),
}));

vi.mock("@/components/ChangeEmailDialog", () => ({
  ChangeEmailDialog: ({
    open,
    currentEmail,
    hasGoogleIdentity,
    hasPassword,
  }: {
    open: boolean;
    currentEmail: string;
    hasGoogleIdentity?: boolean;
    hasPassword?: boolean;
  }) =>
    open ? (
      <div role="dialog" aria-label="Change sign-in email">
        <p>{currentEmail}</p>
        <p>Google {String(hasGoogleIdentity)}</p>
        <p>Password {String(hasPassword)}</p>
      </div>
    ) : null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const accountStatus = {
  createdAt: "2026-01-01T12:00:00.000Z",
  emailVerified: true,
  privacyAcceptedAt: "2026-01-01T12:05:00.000Z",
  hasPendingEmailChange: false,
  pendingEmailRequestedAt: null,
  verificationRequestedAt: "2026-01-02T09:00:00.000Z",
  hasPassword: true,
  hasGoogleIdentity: true,
};

const profile = {
  _id: "u1",
  personalDetails: { email: "u@test.local" },
  accountStatus,
  pendingEmail: "pending-address@test.com",
  verificationToken: "verification-token-value",
  resetPasswordToken: "reset-token-value",
  googleId: "google-subject-value",
};

function renderPage(language?: "en" | "es") {
  return renderWithI18n(
    <MemoryRouter initialEntries={["/account/security"]}>
      <Routes>
        <Route path="/account/security" element={<CustomerSecurityPage />} />
      </Routes>
    </MemoryRouter>,
    { language },
  );
}

describe("CustomerSecurityPage", () => {
  beforeEach(() => {
    mockResendPending.value = false;
    mockGetUserProfile.mockReset();
    mockResend.mockReset();
    mockRequestEmailChange.mockReset();
    toastSuccess.mockReset();
    mockGetUserProfile.mockResolvedValue({ ok: true, data: profile });
  });

  it("renders the read-only email, Google status, and account facts", async () => {
    await renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Sign-in & security",
      }),
    ).toBeInTheDocument();
    const email = await screen.findByLabelText("Sign-in email");
    expect(email).toHaveValue("u@test.local");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByText("This email is verified.")).toBeInTheDocument();
    expect(screen.getByText("Google connected")).toBeInTheDocument();

    expect(screen.getByText("Account created")).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(accountStatus.createdAt, "en")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(accountStatus.privacyAcceptedAt, "en")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        formatDateTime(accountStatus.verificationRequestedAt, "en"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByText("Google identity")).toBeInTheDocument();
    expect(
      screen.getByText("Email change pending").parentElement,
    ).toHaveTextContent("No");
    expect(mockGetUserProfile).toHaveBeenCalledWith("u1");
  });

  it("never renders the pending address, tokens, or server-owned internals", async () => {
    await renderPage();

    await screen.findByLabelText("Sign-in email");

    const body = document.body.textContent ?? "";
    expect(body).not.toContain("pending-address@test.com");
    expect(body).not.toContain("verification-token-value");
    expect(body).not.toContain("reset-token-value");
    expect(body).not.toContain("google-subject-value");
    expect(screen.queryByText("Marketing consent")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Last password reset requested"),
    ).not.toBeInTheDocument();
  });

  it("shows the unverified banner and resends the confirmation email", async () => {
    const user = userEvent.setup();
    mockGetUserProfile.mockResolvedValue({
      ok: true,
      data: {
        ...profile,
        accountStatus: { ...accountStatus, emailVerified: false },
      },
    });

    await renderPage();

    expect(await screen.findByText("Confirm your email")).toBeInTheDocument();
    expect(
      screen.getByText("This email is not verified yet."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Resend confirmation email" }),
    );
    expect(mockResend).toHaveBeenCalledTimes(1);
  });

  it("shows not-connected Google status when no identity is linked", async () => {
    mockGetUserProfile.mockResolvedValue({
      ok: true,
      data: {
        ...profile,
        accountStatus: { ...accountStatus, hasGoogleIdentity: false },
      },
    });

    await renderPage();

    expect(await screen.findByText("Google not connected")).toBeInTheDocument();
  });

  it("opens the verified email-change flow with the account-status flags", async () => {
    const user = userEvent.setup();

    await renderPage();

    await screen.findByLabelText("Sign-in email");
    await user.click(
      screen.getByRole("button", { name: "Change sign-in email" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Change sign-in email",
    });
    expect(dialog).toHaveTextContent("u@test.local");
    expect(dialog).toHaveTextContent("Google true");
    expect(dialog).toHaveTextContent("Password true");
  });

  it("shows pending email-change facts without the pending address", async () => {
    mockGetUserProfile.mockResolvedValue({
      ok: true,
      data: {
        ...profile,
        accountStatus: {
          ...accountStatus,
          hasPendingEmailChange: true,
          pendingEmailRequestedAt: "2026-01-05T10:00:00.000Z",
        },
      },
    });

    await renderPage();

    await screen.findByLabelText("Sign-in email");
    expect(screen.getByText("Email change pending")).toBeInTheDocument();
    expect(
      screen.getByText(
        formatDateTime("2026-01-05T10:00:00.000Z", "en"),
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "pending-address@test.com",
    );
  });

  it("localizes the destination and facts into Spanish", async () => {
    await renderPage("es");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Inicio de sesión y seguridad",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo de acceso")).toHaveValue(
      "u@test.local",
    );
    expect(screen.getByText("Google conectado")).toBeInTheDocument();
    expect(screen.getByText("Datos de la cuenta")).toBeInTheDocument();
    expect(screen.getByText("Cuenta creada")).toBeInTheDocument();
  });

  it("uses localized problem-details copy when the profile read fails", async () => {
    mockGetUserProfile.mockResolvedValue({
      ok: false,
      error: { code: "profileFetch.notFound" },
    });

    await renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The requested item could not be found.",
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 1, name: "Sign-in & security" }),
      ).toBeInTheDocument(),
    );
  });
});
