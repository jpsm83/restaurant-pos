import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { ServiceRequestError } from "@/services/serviceErrors";
import { ChangePasswordDialog } from "../ChangePasswordDialog";

const mockChangePassword = vi.fn();
const mockOnChanged = vi.fn();
const mockOnOpenChange = vi.fn();
const googleEnabled = vi.hoisted(() => ({ value: true }));

vi.mock("@/auth/api", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

vi.mock("@/auth/useGoogleSignInEnabled", () => ({
  useGoogleSignInEnabled: () => googleEnabled.value,
}));

vi.mock("@/auth/GoogleReauthButton", () => ({
  GoogleReauthButton: ({
    onCredential,
  }: {
    onCredential: (credential: string) => void;
  }) => (
    <button type="button" onClick={() => onCredential("google-id-token")}>
      Reauth with Google
    </button>
  ),
}));

const oldPassword = "TestPassword123!";
const newPassword = "NewPassword456!";

const session = {
  id: "u1",
  email: "u@test.local",
  type: "user" as const,
  role: "Customer",
  hasPassword: true,
};

function renderDialog({
  hasPassword = true,
  hasGoogleIdentity = false,
}: {
  hasPassword?: boolean;
  hasGoogleIdentity?: boolean;
} = {}) {
  return renderWithI18n(
    <ChangePasswordDialog
      open
      hasPassword={hasPassword}
      hasGoogleIdentity={hasGoogleIdentity}
      onOpenChange={mockOnOpenChange}
      onChanged={mockOnChanged}
    />,
  );
}

function fieldError(field: string) {
  return new ServiceRequestError({
    code: "passwordChange.validation",
    status: 400,
    fieldErrors: [{ field, message: "server detail" }],
  });
}

describe("ChangePasswordDialog", () => {
  beforeEach(() => {
    googleEnabled.value = true;
    mockChangePassword.mockReset();
    mockOnChanged.mockReset();
    mockOnOpenChange.mockReset();
    mockChangePassword.mockResolvedValue({
      ok: true,
      data: { ...session, hasPassword: true },
    });
  });

  it("changes the password after proving the current password", async () => {
    const user = userEvent.setup();
    await renderDialog();

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.type(screen.getByLabelText("Current password"), oldPassword);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith(
        newPassword,
        newPassword,
        { currentPassword: oldPassword },
      ),
    );
    expect(mockOnChanged).toHaveBeenCalledWith(
      expect.objectContaining({ hasPassword: true }),
    );
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects a confirmation mismatch before calling the server", async () => {
    const user = userEvent.setup();
    await renderDialog();

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "DifferentPassword789!",
    );
    await user.type(screen.getByLabelText("Current password"), oldPassword);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      screen.getByText("Password and confirm password must match."),
    ).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("rejects a policy-breaking password before calling the server", async () => {
    const user = userEvent.setup();
    await renderDialog();

    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm new password"), "short");
    await user.type(screen.getByLabelText("Current password"), oldPassword);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      screen.getByText(/Password must be at least 8 characters/),
    ).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("requires the current password for a password User", async () => {
    const user = userEvent.setup();
    await renderDialog();

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Enter your current password.")).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("surfaces a wrong current password as a field error", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({
      ok: false,
      error: fieldError("currentPassword"),
    });
    await renderDialog();

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.type(screen.getByLabelText("Current password"), "WrongPassword123!");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Your current password is incorrect."),
    ).toBeInTheDocument();
    expect(mockOnChanged).not.toHaveBeenCalled();
  });

  it("lets a Google-only User set a password with a Google proof", async () => {
    const user = userEvent.setup();
    await renderDialog({ hasPassword: false, hasGoogleIdentity: true });

    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.click(screen.getByRole("button", { name: "Reauth with Google" }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith(
        newPassword,
        newPassword,
        { googleCredential: "google-id-token" },
      ),
    );
  });

  it("lets a mixed account change with the current password", async () => {
    const user = userEvent.setup();
    await renderDialog({ hasPassword: true, hasGoogleIdentity: true });

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.type(screen.getByLabelText("Current password"), oldPassword);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith(
        newPassword,
        newPassword,
        { currentPassword: oldPassword },
      ),
    );
  });

  it("offers either proof when the account has both", async () => {
    const user = userEvent.setup();
    await renderDialog({ hasPassword: true, hasGoogleIdentity: true });

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reauth with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Or confirm with your current password"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.click(screen.getByRole("button", { name: "Reauth with Google" }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith(
        newPassword,
        newPassword,
        { googleCredential: "google-id-token" },
      ),
    );
  });

  it("surfaces a failed Google proof as a field error", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({
      ok: false,
      error: fieldError("googleCredential"),
    });
    await renderDialog({ hasPassword: false, hasGoogleIdentity: true });

    await user.type(screen.getByLabelText("New password"), newPassword);
    await user.type(screen.getByLabelText("Confirm new password"), newPassword);
    await user.click(screen.getByRole("button", { name: "Reauth with Google" }));

    expect(
      await screen.findByText(/We couldn't verify that Google account/),
    ).toBeInTheDocument();
  });
});
