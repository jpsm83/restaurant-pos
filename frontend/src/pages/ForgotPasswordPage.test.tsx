import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ForgotPasswordPage from "./ForgotPasswordPage";

const mockRequestPasswordReset = vi.fn();

vi.mock("@/auth/api", () => ({
  requestPasswordReset: (...args: unknown[]) =>
    mockRequestPasswordReset(...args),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
  });

  function renderPage() {
    return renderWithI18n(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("shows required validation when email is empty", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("shows invalid email when format is wrong", async () => {
    const user = userEvent.setup();
    await renderPage();

    // Passes native `type="email"` in jsdom but fails shared `emailRegex` (TLD must be 2+ letters).
    await user.type(screen.getByLabelText(/email/i), "me@you.c");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(
      screen.getByText("Please provide a valid email address."),
    ).toBeInTheDocument();
  });

  it("redirects to login after API ok", async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockResolvedValue({
      ok: true,
      data: { message: "If an account exists…" },
    });

    await renderPage();

    await user.type(screen.getByLabelText(/email/i), "patron@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Login Screen")).toBeInTheDocument();
    });
    expect(mockRequestPasswordReset).toHaveBeenCalledWith("patron@example.com");
  });

  it("shows API error in an alert", async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockResolvedValue({
      ok: false,
      error: "Rate limited",
    });

    await renderPage();

    await user.type(screen.getByLabelText(/email/i), "patron@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Rate limited")).toBeInTheDocument();
    });
  });
});
