import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { renderWithI18n } from "@/test/i18nTestUtils";

const mockDispatch = vi.fn();

vi.mock("@/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth")>();
  return {
    ...actual,
    useAuth: () => ({ dispatch: mockDispatch }),
    logout: vi.fn(async () => undefined),
    setAccessToken: vi.fn(),
  };
});

describe("AccountMenuPopover (actor summary)", () => {
  it("shows actor type, email, language switcher, profile, and log out", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/dashboard"]}>
        <AccountMenuPopover
          session={{
            id: "64b000000000000000000001",
            email: "owner@restaurant.com",
            type: "business",
          }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/business/i)).toBeInTheDocument();
    expect(screen.getByText("owner@restaurant.com")).toBeInTheDocument();

    // Language flag button (aria-label is in `common` namespace).
    expect(screen.getByRole("button", { name: /language/i })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});
