import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/auth/types";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { MODE_STORAGE_KEY, resetThemeStore } from "@/hooks/useTheme";
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

const ownerSession: AuthSession = {
  id: "64b000000000000000000001",
  email: "owner@restaurant.com",
  type: "user",
  role: "Customer",
};

async function openAccountMenu() {
  const user = userEvent.setup();

  await renderWithI18n(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AccountMenuPopover session={ownerSession} />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: /account menu/i }));

  return user;
}

describe("AccountMenuPopover (single-User handoff surface)", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogout.mockReset();
    mockSetAccessToken.mockReset();
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: () => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    resetThemeStore();
  });

  it("shows the User summary, profile, language, and log out", async () => {
    await openAccountMenu();

    expect(screen.getByText(/customer/i)).toBeInTheDocument();
    expect(screen.getByText("owner@restaurant.com")).toBeInTheDocument();

    // Language flag button (aria-label is in `common` namespace).
    expect(screen.getByRole("button", { name: /language/i })).toBeInTheDocument();

    expect(screen.getByRole("menuitem", { name: /profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /subscriptions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^address$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /credentials/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });

  it("exposes only the current User and sign-out, with no excluded identity flow", async () => {
    await openAccountMenu();

    const menu = await screen.findByRole("menu");

    expect(within(menu).getByText("owner@restaurant.com")).toBeInTheDocument();
    expect(
      within(menu).getAllByRole("menuitem").map((item) => item.textContent?.trim()),
    ).toEqual(["Profile", "Log out"]);
    expect(
      within(menu).getAllByRole("menuitemradio").map((item) => item.textContent?.trim()),
    ).toEqual(["Light", "Dark", "System"]);

    // The only other control is the language switcher: no user picker, keypad, or lock.
    expect(within(menu).getAllByRole("button")).toHaveLength(1);
    expect(
      within(menu).getByRole("button", { name: /change language/i }),
    ).toBeInTheDocument();

    for (const role of [
      "link",
      "combobox",
      "listbox",
      "option",
      "textbox",
      "searchbox",
      "checkbox",
      "radio",
      "switch",
      "tab",
    ] as const) {
      expect(within(menu).queryAllByRole(role)).toHaveLength(0);
    }

    expect(menu).not.toHaveTextContent(
      /switch|saved user|user picker|change (account|user|person)|add account|another account|\bpin\b|passcode|\block\b|unlock/i,
    );
  });

  it("signs out the current User rather than switching the acting person", async () => {
    const user = await openAccountMenu();

    await user.click(screen.getByRole("menuitem", { name: /log out/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockSetAccessToken).toHaveBeenCalledWith(null);
    expect(mockDispatch).toHaveBeenCalledWith({ type: "AUTH_CLEAR" });
  });

  it("offers Light, Dark, and System and persists the chosen mode", async () => {
    const user = await openAccountMenu();

    expect(
      screen.getByRole("menuitemradio", { name: "Light" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Dark" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "System" }),
    ).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    await waitFor(() => {
      expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("dark");
    });
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("default");
  });
});
