import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/auth/types";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import type { SupportedLanguage } from "@/i18n/config";
import type { AuthMode } from "@/services/authMode";
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

async function openAccountMenu(
  mode: AuthMode = "customer",
  language?: SupportedLanguage,
  session: AuthSession = ownerSession,
) {
  const user = userEvent.setup();

  await renderWithI18n(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <LocationProbe />
      <AccountMenuPopover session={session} mode={mode} />
    </MemoryRouter>,
    { language },
  );

  const menuLabel = language === "es" ? /menú de cuenta/i : /account menu/i;
  await user.click(screen.getByRole("button", { name: menuLabel }));

  return user;
}

describe("AccountMenuPopover (single-User handoff surface)", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogout.mockReset();
    mockSetAccessToken.mockReset();
    localStorage.clear();
  });

  it("shows the Customer summary, a read-only language indicator, Preferences, and log out", async () => {
    await openAccountMenu();

    expect(screen.getByText(/^customer$/i)).toBeInTheDocument();
    expect(screen.getByText("owner@restaurant.com")).toBeInTheDocument();

    const indicator = screen.getByRole("img", {
      name: /current language: english/i,
    });
    expect(indicator).toHaveTextContent("English");

    expect(screen.getByRole("menuitem", { name: /account/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /preferences/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /subscriptions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^address$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /credentials/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });

  it("renders the stored profile picture in the chrome avatar", async () => {
    const imageUrl = "https://lh3.googleusercontent.com/a/avatar.png";
    await openAccountMenu("customer", undefined, {
      ...ownerSession,
      imageUrl,
    });

    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger.querySelector("img")).toHaveAttribute("src", imageUrl);
  });

  it("falls back to initials when the account has no profile picture", async () => {
    await openAccountMenu();

    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger).toHaveTextContent("OW");
  });

  it("uses the profile name for initials when no picture is stored", async () => {
    await openAccountMenu("customer", undefined, {
      ...ownerSession,
      firstName: "Pat",
      lastName: "Lee",
    });

    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger).toHaveTextContent("PL");
  });

  it("shows the Business summary instead of an employee actor type", async () => {
    await openAccountMenu("business");

    expect(screen.getByText(/^business$/i)).toBeInTheDocument();
    expect(screen.queryByText(/employee/i)).not.toBeInTheDocument();
  });

  it("opens the customer account area from the Account entry", async () => {
    const user = await openAccountMenu("business");

    await user.click(screen.getByRole("menuitem", { name: /account/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/account$/);
    });
  });

  it("opens the canonical Preferences URL from the Preferences entry", async () => {
    const user = await openAccountMenu("business");

    await user.click(screen.getByRole("menuitem", { name: /preferences/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/account\/preferences$/,
      );
    });
  });

  it("exposes only the current User, Preferences, and sign-out, with no excluded identity flow", async () => {
    await openAccountMenu();

    const menu = await screen.findByRole("menu");

    expect(within(menu).getByText("owner@restaurant.com")).toBeInTheDocument();
    expect(
      within(menu).getByRole("img", { name: /current language: english/i }),
    ).toBeInTheDocument();
    expect(within(menu).getByText("English")).toBeInTheDocument();
    expect(
      within(menu).getAllByRole("menuitem").map((item) => item.textContent?.trim()),
    ).toEqual(["Account", "Preferences", "Log out"]);

    // Navigation popover only: no language dropdown and no appearance radio group.
    expect(within(menu).queryAllByRole("button")).toHaveLength(0);
    expect(within(menu).queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(within(menu).queryByText(/light|dark|system/i)).not.toBeInTheDocument();

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

  it("localizes the read-only language indicator", async () => {
    await openAccountMenu("customer", "es");

    expect(
      screen.getByRole("img", { name: /idioma actual: español/i }),
    ).toHaveTextContent("Español");
  });

  it("signs out the current User rather than switching the acting person", async () => {
    const user = await openAccountMenu();

    await user.click(screen.getByRole("menuitem", { name: /log out/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockSetAccessToken).toHaveBeenCalledWith(null);
    expect(mockDispatch).toHaveBeenCalledWith({ type: "AUTH_CLEAR" });
  });
});
