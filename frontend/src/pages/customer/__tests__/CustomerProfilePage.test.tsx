import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerProfilePage from "../CustomerProfilePage";

const mockGetUserProfile = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockRequestEmailChange = vi.fn();
const mockUseAuthConfigQuery = vi.fn();
const mockDispatch = vi.fn();
const mockResend = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

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
    state: { status: "authenticated", user: mockUser(), error: null },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/auth/api", () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
  requestEmailChange: (...args: unknown[]) => mockRequestEmailChange(...args),
  useAuthConfigQuery: (...args: unknown[]) => mockUseAuthConfigQuery(...args),
}));

vi.mock("@/hooks/useResendEmailConfirmation", () => ({
  useResendEmailConfirmation: () => ({ resend: mockResend, pending: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

let unverified = false;
let googleLinked = false;
let passwordPresent = true;

function mockUser() {
  return {
    id: "u1",
    email: "u@test.local",
    type: "user" as const,
    role: "Customer",
    emailVerified: unverified ? false : true,
    languagePreference: "en" as const,
    hasGoogleIdentity: googleLinked,
    hasPassword: passwordPresent,
  };
}

const profile = {
  _id: "u1",
  personalDetails: {
    email: "u@test.local",
    username: "pat",
    firstName: "Pat",
    lastName: "Lee",
    phoneNumber: "5551234",
    birthDate: "1990-01-01T00:00:00.000Z",
    gender: "Woman",
    nationality: "USA",
    address: {
      country: "USA",
      state: "CA",
      city: "Los Angeles",
      street: "Main St",
      buildingNumber: "123",
      postCode: "90001",
    },
  },
  languagePreference: "en" as const,
};

function renderPage() {
  return renderWithI18n(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<CustomerProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CustomerProfilePage", () => {
  beforeEach(() => {
    unverified = false;
    googleLinked = false;
    passwordPresent = true;
    mockGetUserProfile.mockReset();
    mockUpdateUserProfile.mockReset();
    mockRequestEmailChange.mockReset();
    mockUseAuthConfigQuery.mockReset();
    mockDispatch.mockReset();
    mockResend.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    mockGetUserProfile.mockResolvedValue({ ok: true, data: profile });
    mockUseAuthConfigQuery.mockReturnValue({
      data: { googleSignInEnabled: true },
    });
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads the self profile with a read-only sign-in email and editable fields", async () => {
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Profile" }),
    ).toBeInTheDocument();
    const email = await screen.findByLabelText("Sign-in email");
    expect(email).toHaveValue("u@test.local");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByLabelText("First name")).toHaveValue("Pat");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lee");
    expect(screen.getByLabelText("Phone number")).toHaveValue("5551234");
    expect(screen.getByLabelText("Birth date")).toHaveValue("1990-01-01");
    expect(screen.getByLabelText("Country")).toHaveValue("USA");
    expect(mockGetUserProfile).toHaveBeenCalledWith("u1");
  });

  it("saves edited profile fields and language as multipart", async () => {
    const user = userEvent.setup();
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: {
        message: "User updated successfully!",
        user: {
          ...profile,
          personalDetails: { ...profile.personalDetails, firstName: "Updated" },
          languagePreference: "es",
        },
      },
    });

    await renderPage();
    const firstName = await screen.findByLabelText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Updated");

    await user.click(screen.getByLabelText("Language"));
    await user.click(await screen.findByRole("option", { name: "Español" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    const [, languageData] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(languageData.get("languagePreference")).toBe("es");
    expect(languageData.get("firstName")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(2);
    });
    const [userId, formData] = mockUpdateUserProfile.mock.calls[1] as [
      string,
      FormData,
    ];
    expect(userId).toBe("u1");
    expect(formData.get("firstName")).toBe("Updated");
    expect(formData.get("languagePreference")).toBe("es");
    expect(JSON.parse(String(formData.get("address")))).toMatchObject({
      country: "USA",
      postCode: "90001",
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Your profile has been saved.");
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "AUTH_SUCCESS",
      payload: expect.objectContaining({ languagePreference: "es" }),
    });
  });

  it("requests a sign-in email change after password re-authentication", async () => {
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue({
      ok: true,
      data: { message: "Sent" },
    });

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Change sign-in email" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("New email"), "New@Example.com");
    await user.type(screen.getByLabelText("Current password"), "Secret123!");
    await user.click(
      screen.getByRole("button", { name: "Send confirmation link" }),
    );

    await waitFor(() => {
      expect(mockRequestEmailChange).toHaveBeenCalledWith("new@example.com", {
        currentPassword: "Secret123!",
      });
    });
    expect(
      await screen.findByText(
        "Confirmation link sent. Check your new inbox to complete the change.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Change sign-in email" }),
    ).not.toBeInTheDocument();
  });

  it("shows localized copy when the current password is refused", async () => {
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue({
      ok: false,
      error: { code: "emailChange.unauthorized", status: 401 },
    });

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );
    await user.type(screen.getByLabelText("New email"), "new@example.com");
    await user.type(screen.getByLabelText("Current password"), "wrong");
    await user.click(
      screen.getByRole("button", { name: "Send confirmation link" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Your current password is incorrect.");
  });

  it("lets a mixed account re-authenticate with Google and completes the request", async () => {
    googleLinked = true;
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue({
      ok: true,
      data: { message: "Sent" },
    });

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    await user.type(screen.getByLabelText("New email"), "New@Example.com");
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() => {
      expect(mockRequestEmailChange).toHaveBeenCalledWith("new@example.com", {
        googleCredential: "google-id-token",
      });
    });
    expect(
      await screen.findByText(
        "Confirmation link sent. Check your new inbox to complete the change.",
      ),
    ).toBeInTheDocument();
  });

  it("lets a mixed account re-authenticate with its password", async () => {
    googleLinked = true;
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue({
      ok: true,
      data: { message: "Sent" },
    });

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );
    await user.type(screen.getByLabelText("New email"), "new@example.com");
    await user.type(screen.getByLabelText("Current password"), "Secret123!");
    await user.click(
      screen.getByRole("button", { name: "Send confirmation link" }),
    );

    await waitFor(() => {
      expect(mockRequestEmailChange).toHaveBeenCalledWith("new@example.com", {
        currentPassword: "Secret123!",
      });
    });
  });

  it("shows only Google re-authentication for a Google-only account", async () => {
    googleLinked = true;
    passwordPresent = false;
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Current password"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send confirmation link" }),
    ).not.toBeInTheDocument();
  });

  it("hides Google re-authentication when the account has no linked identity", async () => {
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );

    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Or confirm with your current password"),
    ).not.toBeInTheDocument();
  });

  it("hides Google re-authentication when the server disables Google sign-in", async () => {
    googleLinked = true;
    mockUseAuthConfigQuery.mockReturnValue({
      data: { googleSignInEnabled: false },
    });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );

    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();
  });

  it("shows localized copy when Google re-authentication is refused", async () => {
    googleLinked = true;
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue({
      ok: false,
      error: { code: "emailChange.unauthorized", status: 401 },
    });

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Change sign-in email" }),
    );
    await user.type(screen.getByLabelText("New email"), "new@example.com");
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't verify that Google account. Use the Google account linked to this profile and try again.",
    );
  });

  it("resends email confirmation for an unverified signed-in user", async () => {
    unverified = true;
    const user = userEvent.setup();
    mockResend.mockResolvedValue(undefined);

    await renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Resend confirmation email",
      }),
    );

    expect(mockResend).toHaveBeenCalledTimes(1);
  });
});
