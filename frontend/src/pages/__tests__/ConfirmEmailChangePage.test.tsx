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

function renderAt(path: string, language?: "en" | "es") {
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
    language ? { language } : undefined,
  );
}

describe("ConfirmEmailChangePage", () => {
  beforeEach(() => {
    mockConfirmEmailChange.mockReset();
    mockSetAccessToken.mockReset();
    mockDispatch.mockReset();
    localStorage.clear();
  });

  it("shows the missing-token message without calling the API", async () => {
    await renderAt("/confirm-email-change");

    expect(
      screen.getByText(
        "This link is missing a confirmation token. Open the link from your email or request a new email change.",
      ),
    ).toBeInTheDocument();
    expect(mockConfirmEmailChange).not.toHaveBeenCalled();
  });

  it("renders the Spanish missing-token copy", async () => {
    await renderAt("/confirm-email-change", "es");

    expect(
      screen.getByText(
        "Falta el token de confirmación en el enlace. Ábrelo desde el correo o solicita un nuevo cambio de correo.",
      ),
    ).toBeInTheDocument();
  });

  it("confirms the token, clears the local session, and returns to sign in with the outcome", async () => {
    localStorage.setItem("auth_had_session", "1");
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
    expect(localStorage.getItem("auth_had_session")).toBeNull();
    expect(mockDispatch).toHaveBeenCalledWith({ type: "AUTH_CLEAR" });
  });

  it("shows the same non-revealing outcome for an invalid or expired token", async () => {
    mockConfirmEmailChange.mockResolvedValue({
      ok: false,
      error: {
        code: "confirmEmailChange.badRequest",
        status: 400,
        fieldErrors: [],
      },
    });

    await renderAt("/confirm-email-change?token=expired");

    await waitFor(() => {
      expect(
        screen.getByText(
          "This confirmation link is invalid or has expired. Request a new email change.",
        ),
      ).toBeInTheDocument();
    });
    expect(mockSetAccessToken).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
