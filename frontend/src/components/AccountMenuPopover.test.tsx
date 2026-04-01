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

describe("AccountMenuPopover business navigation", () => {
  it("shows separate Home and Dashboard links for business", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/home"]}>
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
    const homeLink = await screen.findByRole("link", { name: /home/i });
    const dashboardLink = await screen.findByRole("link", { name: /dashboard/i });
    expect(homeLink).toHaveAttribute(
      "href",
      "/business/64b000000000000000000001/home",
    );
    expect(dashboardLink).toHaveAttribute(
      "href",
      "/business/64b000000000000000000001/dashboard",
    );
  });
});
