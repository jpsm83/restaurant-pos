import { describe, it, expect } from "vitest";
import {
  DEFAULT_ACCOUNT_EMAIL_LANGUAGE,
  pickAccountEmailTranslation,
  resolveAccountEmailLanguage,
} from "../../src/auth/recipientLanguage.ts";

describe("resolveAccountEmailLanguage", () => {
  it("maps a supported stored preference", () => {
    expect(resolveAccountEmailLanguage("en")).toBe("en");
    expect(resolveAccountEmailLanguage("es")).toBe("es");
  });

  it("falls back to English when the preference is missing or unknown", () => {
    expect(resolveAccountEmailLanguage(undefined)).toBe(
      DEFAULT_ACCOUNT_EMAIL_LANGUAGE,
    );
    expect(resolveAccountEmailLanguage(null)).toBe(
      DEFAULT_ACCOUNT_EMAIL_LANGUAGE,
    );
    expect(resolveAccountEmailLanguage("")).toBe(
      DEFAULT_ACCOUNT_EMAIL_LANGUAGE,
    );
    expect(resolveAccountEmailLanguage("fr")).toBe(
      DEFAULT_ACCOUNT_EMAIL_LANGUAGE,
    );
    expect(resolveAccountEmailLanguage(42)).toBe(
      DEFAULT_ACCOUNT_EMAIL_LANGUAGE,
    );
  });

  it("uses English when the dictionary is missing the requested language", () => {
    const dictionary = { en: { subject: "Hello" } };

    expect(pickAccountEmailTranslation(dictionary, "es")).toEqual({
      subject: "Hello",
    });
  });
});
