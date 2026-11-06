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

/** Map an i18next locale (for example `es-MX`) onto a supported bundle. */
export function effectiveLanguage(code: string): SupportedLanguage {
  const base = code.split("-")[0]?.toLowerCase() ?? "";
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

/**
 * The supported language the browser prefers, falling back to English.
 *
 * Reads `navigator.languages` in preference order after `navigator.language`;
 * an unsupported tag is skipped so a later supported preference can win.
 */
export function resolveBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  const tags = [navigator.language, ...(navigator.languages ?? [])];
  for (const tag of tags) {
    const base = tag?.split("-")[0]?.toLowerCase();
    if (base && isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
