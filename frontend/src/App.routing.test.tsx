import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { renderWithI18n } from "@/test/i18nTestUtils";

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: null,
      status: "unauthenticated",
      error: null,
    },
    dispatch: vi.fn(),
  }),
}));

describe("App public routing (Phase 1.5.1)", () => {
  it("renders `/` with customer marketing heading", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /order and dine with confidence/i }),
    ).toBeInTheDocument();
  });

  it("navigates to `/business` and shows business marketing heading", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: /switch to business/i }));

    expect(
      await screen.findByRole("heading", {
        name: /one platform for service, stock, and numbers/i,
      }),
    ).toBeInTheDocument();
  });

  it("toggle returns from `/business` to `/` with customer heading", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /one platform for service, stock, and numbers/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /switch to user/i }));

    expect(
      await screen.findByRole("heading", { name: /order and dine with confidence/i }),
    ).toBeInTheDocument();
  });
});
