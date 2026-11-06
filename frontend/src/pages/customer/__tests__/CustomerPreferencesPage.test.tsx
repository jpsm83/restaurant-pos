import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThemeStore,
  installThemeStore,
  MODE_STORAGE_KEY,
} from "@/hooks/useTheme";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerPreferencesPage from "../CustomerPreferencesPage";

const { mockUseAuth, mockUpdateUserProfile, mockDispatch } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUpdateUserProfile: vi.fn(),
  mockDispatch: vi.fn(),
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/api", () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

const profile = {
  _id: "u1",
  personalDetails: { email: "u@test.local" },
  themePreference: "dark" as const,
};

function authenticatedUser(themePreference: "light" | "dark" | "system" = "system") {
  return {
    id: "u1",
    email: "u@test.local",
    type: "user" as const,
    role: "Customer",
    themePreference,
  };
}

describe("CustomerPreferencesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
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
    installThemeStore(createThemeStore());
    mockUseAuth.mockReset();
    mockUpdateUserProfile.mockReset();
    mockDispatch.mockReset();
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: authenticatedUser(),
        error: null,
      },
      dispatch: mockDispatch,
    });
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: { user: profile },
    });
  });

  it("renders the Appearance section reflecting the current effective mode", async () => {
    localStorage.setItem(MODE_STORAGE_KEY, "dark");
    installThemeStore(createThemeStore());

    await renderWithI18n(<CustomerPreferencesPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Preferences" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Appearance" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
  });

  it("applies a selection immediately and persists it through the profile API", async () => {
    const user = userEvent.setup();

    await renderWithI18n(<CustomerPreferencesPage />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("dark");

    await waitFor(() =>
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1),
    );
    const [userId, data] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(userId).toBe("u1");
    expect(data.get("themePreference")).toBe("dark");
  });

  it("shows a localized error when the save fails", async () => {
    const user = userEvent.setup();
    mockUpdateUserProfile.mockResolvedValue({
      ok: false,
      error: { code: "profileUpdate.internal", status: 500 },
    });

    await renderWithI18n(<CustomerPreferencesPage />, { language: "es" });

    await user.click(
      screen.getByRole("radio", { name: "Oscuro" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "No se pudo guardar tu preferencia de apariencia. Inténtalo de nuevo.",
    );
  });
});
