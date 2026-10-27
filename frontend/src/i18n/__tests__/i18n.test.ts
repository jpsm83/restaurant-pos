import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { changeAppLanguage } from "../i18n";
import {
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
} from "../config";

describe("i18n module", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  it("owns one shared language and namespace source", () => {
    expect(NAMESPACES).toContain("common");
    expect(NAMESPACES).toContain("errors");
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es"]);
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("guards supported languages", () => {
    expect(isSupportedLanguage("es")).toBe(true);
    expect(isSupportedLanguage("pt")).toBe(false);
  });

  it("keeps the document language aligned with the active language", () => {
    expect(document.documentElement.lang).toBe(i18n.language);
    expect(SUPPORTED_LANGUAGES).toContain(document.documentElement.lang);
  });

  it("ignores unsupported language codes", async () => {
    const spy = vi.spyOn(i18n, "changeLanguage");
    const before = document.documentElement.lang;

    await changeAppLanguage("pt");

    expect(spy).not.toHaveBeenCalled();
    expect(document.documentElement.lang).toBe(before);
  });

  it("applies supported language changes without reload and updates the document", async () => {
    const spy = vi.spyOn(i18n, "changeLanguage");

    await changeAppLanguage("es");

    expect(spy).toHaveBeenCalledWith("es");
    expect(i18n.language).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem(I18N_STORAGE_KEY)).toBe("es");
  });

  it("changes only UI-language state, not Business or session state", async () => {
    localStorage.setItem("pos.theme", "default");
    localStorage.setItem("auth_had_session", "1");
    sessionStorage.setItem("restaurant_pos_auth_access", "access-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await changeAppLanguage("es");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("pos.theme")).toBe("default");
    expect(localStorage.getItem("auth_had_session")).toBe("1");
    expect(sessionStorage.getItem("restaurant_pos_auth_access")).toBe(
      "access-token",
    );
  });
});
