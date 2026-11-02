export const ACCOUNT_EMAIL_LANGUAGES = ["en", "es"] as const;

export type AccountEmailLanguage = (typeof ACCOUNT_EMAIL_LANGUAGES)[number];

export const DEFAULT_ACCOUNT_EMAIL_LANGUAGE: AccountEmailLanguage = "en";

/**
 * Resolves a stored User language preference for account email. Missing,
 * unknown, or unsupported values fall back to English.
 */
export function resolveAccountEmailLanguage(
  preference: unknown,
): AccountEmailLanguage {
  return (
    ACCOUNT_EMAIL_LANGUAGES.find((language) => language === preference) ??
    DEFAULT_ACCOUNT_EMAIL_LANGUAGE
  );
}

/**
 * Picks the requested translation, falling back to English when the dictionary
 * does not carry the requested language.
 */
export function pickAccountEmailTranslation<T>(
  translations: Partial<Record<AccountEmailLanguage, T>>,
  language: AccountEmailLanguage,
): T {
  const picked =
    translations[language] ?? translations[DEFAULT_ACCOUNT_EMAIL_LANGUAGE];
  if (!picked) {
    throw new Error("Account email translations are missing English copy");
  }
  return picked;
}
