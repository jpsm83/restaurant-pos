import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import RequestEmailConfirmationPage from "./RequestEmailConfirmationPage";

const mockRequestEmailConfirmation = vi.fn();

vi.mock("@/auth/api", () => ({
  requestEmailConfirmation: (...args: unknown[]) =>
    mockRequestEmailConfirmation(...args),
}));

describe("RequestEmailConfirmationPage", () => {
  beforeEach(() => {
    mockRequestEmailConfirmation.mockReset();
  });

  function renderPage() {
    return renderWithI18n(
      <MemoryRouter initialEntries={["/request-email-confirmation"]}>
        <Routes>
          <Route
            path="/request-email-confirmation"
            element={<RequestEmailConfirmationPage />}
          />
          <Route path="/" element={<div>Home Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("shows required validation when email is empty", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("shows invalid email when format is wrong", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(/email/i), "me@you.c");
    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    expect(
      screen.getByText("Please provide a valid email address."),
    ).toBeInTheDocument();
  });

  it("redirects to home after API ok", async () => {
    const user = userEvent.setup();
    mockRequestEmailConfirmation.mockResolvedValue({
      ok: true,
      data: { message: "Check your inbox" },
    });

    await renderPage();

    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Home Screen")).toBeInTheDocument();
    });
    expect(mockRequestEmailConfirmation).toHaveBeenCalledWith("u@example.com");
  });

  it("shows API error in an alert", async () => {
    const user = userEvent.setup();
    mockRequestEmailConfirmation.mockResolvedValue({
      ok: false,
      error: "Something went wrong",
    });

    await renderPage();

    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });
});
