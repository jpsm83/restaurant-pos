/**
 * Single source of truth for the frontend i18n rail.
 *
 * The app singleton, the language-options hook, and the test helper all consume these exports;
 * adding or removing a language or namespace happens here once.
 */

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = SUPPORTED_LANGUAGES[0];

export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "marketing",
  "business",
  "customer",
  "employee",
  "mode",
  "errors",
] as const;

/**
 * Dev-only namespace whose copy is registered lazily by its dev-gated module.
 * Deliberately kept out of `NAMESPACES` so the production bundle never includes it.
 */
export const DEV_THEME_GALLERY_NAMESPACE = "devThemeGallery";

/** Persisted via `languageChanged`; read synchronously at init to avoid a locale flash before first paint. */
export const I18N_STORAGE_KEY = "restaurant_pos_i18n_lng";

export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}
