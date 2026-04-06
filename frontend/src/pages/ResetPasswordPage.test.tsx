import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ResetPasswordPage from "./ResetPasswordPage";

const mockResetPassword = vi.fn();

vi.mock("@/auth/api", () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

function renderAt(path: string) {
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
  });

  it("shows missing-token message when query has no token", async () => {
    await renderAt("/reset-password");

    expect(
      screen.getByText(
        "This link is missing a reset token. Open the link from your email or request a new reset.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update password/i }),
    ).not.toBeInTheDocument();
  });

  it("requires both password fields", async () => {
    const user = userEvent.setup();
    await renderAt("/reset-password?token=tok");

    await user.click(screen.getByRole("button", { name: /update password/i }));

    const required = screen.getAllByText(
      "Password and confirmation are required.",
    );
    expect(required.length).toBeGreaterThanOrEqual(2);
  });

  it("shows mismatch when passwords differ", async () => {
    const user = userEvent.setup();
    await renderAt("/reset-password?token=tok");

    await user.type(screen.getByLabelText(/^new password$/i), "ValidPass1!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "ValidPass2!",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      screen.getByText("Password and confirmation must match."),
    ).toBeInTheDocument();
  });

  it("shows policy error for weak password", async () => {
    const user = userEvent.setup();
    await renderAt("/reset-password?token=tok");

    await user.type(screen.getByLabelText(/^new password$/i), "short");
    await user.type(screen.getByLabelText(/confirm new password/i), "short");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      screen.getByText(
        "Password must be at least 8 characters and include a lowercase letter, an uppercase letter, a number, and a symbol.",
      ),
    ).toBeInTheDocument();
  });

  it("redirects to login after API ok", async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue({ ok: true, data: { message: "OK" } });

    await renderAt("/reset-password?token=secret-token");

    await user.type(screen.getByLabelText(/^new password$/i), "ValidPass1!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "ValidPass1!",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText("Login Screen")).toBeInTheDocument();
    });
    expect(mockResetPassword).toHaveBeenCalledWith(
      "secret-token",
      "ValidPass1!",
    );
  });

  it("shows API error in an alert", async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue({
      ok: false,
      error: "Invalid or expired token",
    });

    await renderAt("/reset-password?token=tok");

    await user.type(screen.getByLabelText(/^new password$/i), "ValidPass1!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "ValidPass1!",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid or expired token"),
      ).toBeInTheDocument();
    });
  });
});
