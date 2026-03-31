/**
 * App i18next singleton — **single entry** for bootstrap and direct `i18n` access.
 *
 * **Load order:** `main.tsx` imports this module **before** `createRoot(...).render(...)` so
 * `init()` runs once and `react-i18next` is registered before any `useTranslation` runs.
 *
 * **Exports:** default `i18n` instance (e.g. `ErrorBoundary` uses `i18n.t(...)` outside React),
 * `changeAppLanguage` (used by `LanguageSwitcher`), `NAMESPACES` / `SUPPORTED_LANGUAGES`,
 * `I18N_STORAGE_KEY`, and related types.
 *
 * **Initial language:** `readInitialLanguage()` — valid `localStorage[I18N_STORAGE_KEY]` wins,
 * else first supported tag from `navigator.language` / `navigator.languages`, else `en`.
 * **`languageChanged`** listener persists the chosen code back to `localStorage`.
 *
 * **Locale files:** co-located under `./locales/<lang>/<namespace>.json`, discovered via
 * `import.meta.glob` (see `buildResources`).
 *
 * **Tests:** prefer `createTestI18n` / `renderWithI18n` from `@/test/i18nTestUtils` instead
 * of importing this module, so assertions do not mutate the app singleton.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const NAMESPACES = [
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

export type I18nNamespace = (typeof NAMESPACES)[number];

const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Persisted via `languageChanged`; read synchronously at init to avoid locale flash before first paint. */
export const I18N_STORAGE_KEY = "restaurant_pos_i18n_lng";

function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** First segment of BCP 47 tags (`es-MX` → `es`). */
function readBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return "en";
  const tags = [navigator.language, ...(navigator.languages ?? [])];
  for (const tag of tags) {
    const base = tag?.split("-")[0]?.toLowerCase();
    if (base && isSupportedLanguage(base)) return base;
  }
  return "en";
}

/** Saved choice wins; otherwise browser (`navigator.languages` / `language`); else English. */
function readInitialLanguage(): SupportedLanguage {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(I18N_STORAGE_KEY);
      if (raw && isSupportedLanguage(raw)) return raw;
    } catch {
      /* private mode / blocked storage */
    }
  }
  return readBrowserLanguage();
}

function persistLanguage(lng: string): void {
  if (typeof localStorage === "undefined" || !isSupportedLanguage(lng)) return;
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}

/** Validates against `SUPPORTED_LANGUAGES`, then `i18n.changeLanguage` (persistence runs in `languageChanged`). */
export function changeAppLanguage(code: string): Promise<void> {
  if (!isSupportedLanguage(code)) return Promise.resolve();
  return i18n.changeLanguage(code).then(() => undefined);
}

/** Eager glob: one JSON module per locale file under `locales/<lang>/<namespace>.json`. */
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
  { eager: true },
);

function buildResources(): Record<
  string,
  Partial<Record<I18nNamespace, Record<string, unknown>>>
> {
  const resources: Record<
    string,
    Partial<Record<I18nNamespace, Record<string, unknown>>>
  > = {};

  for (const path of Object.keys(localeModules)) {
    const match = /^\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const lang = match[1];
    const ns = match[2] as I18nNamespace;
    if (!NAMESPACES.includes(ns)) continue;

    const mod = localeModules[path];
    const data = mod.default;
    if (!resources[lang]) resources[lang] = {};
    resources[lang][ns] = data;
  }

  return resources;
}

i18n.on("languageChanged", persistLanguage);

void i18n.use(initReactI18next).init({
  lng: readInitialLanguage(),
  fallbackLng: "en",
  supportedLngs: [...SUPPORTED_LANGUAGES],
  resources: buildResources(),
  ns: [...NAMESPACES],
  defaultNS: "common",
  react: {
    // Avoid relying on a root Suspense boundary for language changes (default `useSuspense: true`).
    useSuspense: false,
  },
  interpolation: {
    // React already escapes text in JSX. Keep false so interpolation can output markup only when intentional.
    // Policy: never pass untrusted strings into <Trans> with rich-text `components` unless sanitized server-side.
    escapeValue: false,
  },
});

export default i18n;
export { NAMESPACES, SUPPORTED_LANGUAGES };
