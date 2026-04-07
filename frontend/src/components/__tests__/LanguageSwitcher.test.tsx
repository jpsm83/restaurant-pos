import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as i18nModule from "@/i18n/i18n";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { LanguageSwitcher } from "../LanguageSwitcher";

describe("LanguageSwitcher", () => {
  it("opens menu and calls changeAppLanguage when a locale is chosen", async () => {
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
    spy.mockRestore();
  });
});
