import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { changeAppLanguage } from "../i18n";
import {
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  toSupportedLanguage,
} from "../config";

describe("i18n module", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.removeItem(I18N_STORAGE_KEY);
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  it("owns one shared language and namespace source", () => {
    expect(NAMESPACES).toContain("common");
    expect(NAMESPACES).toContain("errors");
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es"]);
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("guards supported languages and normalizes BCP 47 tags", () => {
    expect(isSupportedLanguage("es")).toBe(true);
    expect(isSupportedLanguage("pt")).toBe(false);
    expect(toSupportedLanguage("es-MX")).toBe("es");
    expect(toSupportedLanguage("pt-BR")).toBeNull();
    expect(toSupportedLanguage(undefined)).toBeNull();
  });

  it("sets the document language on init", () => {
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
});
