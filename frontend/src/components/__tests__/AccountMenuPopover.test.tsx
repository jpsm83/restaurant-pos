import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { renderWithI18n } from "@/test/i18nTestUtils";

const { mockDispatch, mockLogout, mockSetAccessToken } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockLogout: vi.fn(async () => undefined),
  mockSetAccessToken: vi.fn(),
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: { user: null, status: "authenticated", error: null },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/auth/api", () => ({
  logout: mockLogout,
  setAccessToken: mockSetAccessToken,
}));

describe("AccountMenuPopover (actor summary)", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogout.mockReset();
    mockSetAccessToken.mockReset();
  });

  it("shows actor summary, profile, business settings links, and log out", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/dashboard"]}>
        <AccountMenuPopover
          session={{
            id: "64b000000000000000000001",
            email: "owner@restaurant.com",
            type: "business",
            role: "Tenant",
          }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByText(/business/i)).toBeInTheDocument();
    expect(screen.getByText("owner@restaurant.com")).toBeInTheDocument();

    // Language flag button (aria-label is in `common` namespace).
    expect(screen.getByRole("button", { name: /language/i })).toBeInTheDocument();

    expect(screen.getByRole("menuitem", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /subscriptions/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^address$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /credentials/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });
});
