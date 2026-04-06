import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ConfirmEmailPage from "./ConfirmEmailPage";

const mockConfirmEmail = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/auth/api", () => ({
  confirmEmail: (...args: unknown[]) => mockConfirmEmail(...args),
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAt(path: string) {
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/login" element={<div>Login Screen</div>} />
        <Route
          path="/:userId/customer/dashboard"
          element={<div>Customer Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConfirmEmailPage", () => {
  beforeEach(() => {
    mockConfirmEmail.mockReset();
    mockUseAuth.mockReturnValue({
      state: { user: null, status: "unauthenticated", error: null },
    });
  });

  it("shows missing-token message when query has no token", async () => {
    await renderAt("/confirm-email");

    expect(
      screen.getByText(
        "This link is missing a confirmation token. Open the link from your email or request a new confirmation email.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm email/i }),
    ).not.toBeInTheDocument();
  });

  it("redirects to login after successful confirm when no session exists", async () => {
    const user = userEvent.setup();
    mockConfirmEmail.mockResolvedValue({
      ok: true,
      data: { message: "Email verified." },
    });

    await renderAt("/confirm-email?token=abc");

    await user.click(screen.getByRole("button", { name: /confirm email/i }));

    await waitFor(() => {
      expect(screen.getByText("Login Screen")).toBeInTheDocument();
    });
    expect(mockConfirmEmail).toHaveBeenCalledWith("abc");
  });

  it("redirects to actor dashboard after successful confirm when a session exists", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      state: {
        user: { id: "507f1f77bcf86cd799439011", email: "u@test.com", type: "user" },
        status: "authenticated",
        error: null,
      },
    });
    mockConfirmEmail.mockResolvedValue({
      ok: true,
      data: { message: "Email verified." },
    });

    await renderAt("/confirm-email?token=abc");
    await user.click(screen.getByRole("button", { name: /confirm email/i }));

    await waitFor(() => {
      expect(screen.getByText("Customer Dashboard")).toBeInTheDocument();
    });
  });

  it("shows API error after failed confirm", async () => {
    const user = userEvent.setup();
    mockConfirmEmail.mockResolvedValue({
      ok: false,
      error: "Token expired",
    });

    await renderAt("/confirm-email?token=expired");

    await user.click(screen.getByRole("button", { name: /confirm email/i }));

    await waitFor(() => {
      expect(screen.getByText("Token expired")).toBeInTheDocument();
    });
  });
});
