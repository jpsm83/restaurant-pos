import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

  it("shows required validation when email is empty", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <RequestEmailConfirmationPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("shows invalid email when format is wrong", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <RequestEmailConfirmationPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "me@you.c");
    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    expect(
      screen.getByText("Please provide a valid email address."),
    ).toBeInTheDocument();
  });

  it("shows success state after API ok", async () => {
    const user = userEvent.setup();
    mockRequestEmailConfirmation.mockResolvedValue({
      ok: true,
      data: { message: "Check your inbox" },
    });

    await renderWithI18n(
      <MemoryRouter>
        <RequestEmailConfirmationPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Check your inbox")).toBeInTheDocument();
    });
    expect(mockRequestEmailConfirmation).toHaveBeenCalledWith("u@example.com");
  });

  it("shows API error in an alert", async () => {
    const user = userEvent.setup();
    mockRequestEmailConfirmation.mockResolvedValue({
      ok: false,
      error: "Something went wrong",
    });

    await renderWithI18n(
      <MemoryRouter>
        <RequestEmailConfirmationPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.click(
      screen.getByRole("button", { name: /send confirmation email/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });
});
