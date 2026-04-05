import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ConfirmEmailPage from "./ConfirmEmailPage";

const mockConfirmEmail = vi.fn();

vi.mock("@/auth/api", () => ({
  confirmEmail: (...args: unknown[]) => mockConfirmEmail(...args),
}));

function renderAt(path: string) {
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConfirmEmailPage", () => {
  beforeEach(() => {
    mockConfirmEmail.mockReset();
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

  it("confirms on button click and shows success message", async () => {
    const user = userEvent.setup();
    mockConfirmEmail.mockResolvedValue({
      ok: true,
      data: { message: "Email verified." },
    });

    await renderAt("/confirm-email?token=abc");

    await user.click(screen.getByRole("button", { name: /confirm email/i }));

    await waitFor(() => {
      expect(screen.getByText("Email verified.")).toBeInTheDocument();
    });
    expect(mockConfirmEmail).toHaveBeenCalledWith("abc");
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
