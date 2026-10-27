import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ConfirmEmailChangePage from "../ConfirmEmailChangePage";

const mockConfirmEmailChange = vi.fn();
const mockSetAccessToken = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/auth/api", () => ({
  confirmEmailChange: (...args: unknown[]) => mockConfirmEmailChange(...args),
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: { user: null, status: "unauthenticated", error: null },
    dispatch: mockDispatch,
  }),
}));

/** Stands in for the login route, surfacing the flash message the page passes. */
function LoginStub() {
  const location = useLocation();
  const flashMessage = (
    location.state as { flashMessage?: string } | null
  )?.flashMessage;
  return <div>{flashMessage ?? "Login Screen"}</div>;
}

function renderAt(path: string) {
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/confirm-email-change"
          element={<ConfirmEmailChangePage />}
        />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConfirmEmailChangePage", () => {
  beforeEach(() => {
    mockConfirmEmailChange.mockReset();
    mockSetAccessToken.mockReset();
    mockDispatch.mockReset();
    localStorage.clear();
  });

  it("shows a missing-token error without calling the API", async () => {
    await renderAt("/confirm-email-change");

    expect(
      screen.getByText(
        "This link is missing a confirmation token. Open the link from your email or request a new change.",
      ),
    ).toBeInTheDocument();
    expect(mockConfirmEmailChange).not.toHaveBeenCalled();
  });

  it("confirms the token, clears the session, and redirects to login with the outcome", async () => {
    mockConfirmEmailChange.mockResolvedValue({
      ok: true,
      data: { message: "Your sign-in email has been updated." },
    });

    await renderAt("/confirm-email-change?token=secret-token");

    await waitFor(() => {
      expect(
        screen.getByText(
          "Your sign-in email has been updated. Please sign in again.",
        ),
      ).toBeInTheDocument();
    });
    expect(mockConfirmEmailChange).toHaveBeenCalledWith("secret-token");
    expect(mockSetAccessToken).toHaveBeenCalledWith(null);
    expect(mockDispatch).toHaveBeenCalledWith({ type: "AUTH_CLEAR" });
  });

  it("shows a non-revealing error when the token is invalid or expired", async () => {
    mockConfirmEmailChange.mockResolvedValue({
      ok: false,
      error: {
        code: "emailChange.badRequest",
        status: 400,
        message:
          "This link is invalid or has expired. Please request a new one.",
        serverMessage:
          "This link is invalid or has expired. Please request a new one.",
        fieldErrors: [],
      },
    });

    await renderAt("/confirm-email-change?token=expired");

    await waitFor(() => {
      expect(
        screen.getByText(
          "This link is invalid or has expired. Please request a new one.",
        ),
      ).toBeInTheDocument();
    });
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });
});
