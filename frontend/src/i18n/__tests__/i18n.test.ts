import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n, {
  changeAppLanguage,
  I18N_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
} from "../i18n";

describe("i18n module", () => {
  beforeEach(() => {
    localStorage.removeItem(I18N_STORAGE_KEY);
  });

  it("exports expected namespaces and supported languages", () => {
    expect(NAMESPACES).toContain("common");
    expect(NAMESPACES).toContain("errors");
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es"]);
  });

  it("ignores unsupported language codes", async () => {
    const spy = vi.spyOn(i18n, "changeLanguage");
    await changeAppLanguage("pt");
    expect(spy).not.toHaveBeenCalled();
  });

  it("delegates supported language changes to i18next", async () => {
    const spy = vi
      .spyOn(i18n, "changeLanguage")
      .mockResolvedValue(i18n.t.bind(i18n) as never);

    await changeAppLanguage("es");
    expect(spy).toHaveBeenCalledWith("es");
  });
});
