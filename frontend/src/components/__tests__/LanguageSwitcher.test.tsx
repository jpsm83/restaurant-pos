import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as i18nModule from "@/i18n/i18n";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { LanguageSwitcher } from "../LanguageSwitcher";

const mockUseAuth = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/api", () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUpdateUserProfile.mockReset();
    mockDispatch.mockReset();
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
      dispatch: mockDispatch,
    });
  });

  it("applies an anonymous language change without writing a profile", async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(i18nModule, "changeAppLanguage")
      .mockResolvedValue(undefined);

    await renderWithI18n(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: /change language/i }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: /^Español$/ }),
    );

    expect(spy).toHaveBeenCalledWith("es");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("writes a signed-in language change through the profile API", async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(i18nModule, "changeAppLanguage")
      .mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "u1",
          email: "u@test.local",
          type: "user",
          role: "Customer",
          languagePreference: "en",
        },
        error: null,
      },
      dispatch: mockDispatch,
    });
    mockUpdateUserProfile.mockResolvedValue({ ok: true, data: { user: {} } });

    await renderWithI18n(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: /change language/i }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: /^Español$/ }),
    );

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    const [userId, formData] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(userId).toBe("u1");
    expect(formData.get("languagePreference")).toBe("es");
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "AUTH_SUCCESS",
      payload: expect.objectContaining({ languagePreference: "es" }),
    });
    spy.mockRestore();
  });
});
