import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ConfirmEmailPage from "./ConfirmEmailPage";

const mockConfirmEmail = vi.fn();
const mockRefreshSession = vi.fn();
const mockUseAuth = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/auth/api", () => ({
  confirmEmail: (...args: unknown[]) => mockConfirmEmail(...args),
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
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
    mockRefreshSession.mockReset();
    mockDispatch.mockReset();
    mockUseAuth.mockReturnValue({
      state: { user: null, status: "unauthenticated", error: null },
      dispatch: mockDispatch,
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
    const sessionUser = {
      id: "507f1f77bcf86cd799439011",
      email: "u@test.com",
      type: "user" as const,
      emailVerified: true,
      role: "Customer",
    };
    mockUseAuth.mockReturnValue({
      state: {
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
          type: "user",
          role: "Customer",
        },
        status: "authenticated",
        error: null,
      },
      dispatch: mockDispatch,
    });
    mockConfirmEmail.mockResolvedValue({
      ok: true,
      data: { message: "Email verified." },
    });
    mockRefreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "new-access", user: sessionUser },
    });

    await renderAt("/confirm-email?token=abc");
    await user.click(screen.getByRole("button", { name: /confirm email/i }));

    await waitFor(() => {
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "AUTH_SUCCESS",
        payload: sessionUser,
      });
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
