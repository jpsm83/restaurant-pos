/**
 * App i18next singleton — **single entry** for bootstrap and direct `i18n` access.
 *
 * **Load order:** `main.tsx` imports this module **before** `createRoot(...).render(...)` so
 * `init()` runs once and `react-i18next` is registered before any `useTranslation` runs.
 *
 * **Source of truth:** supported languages, namespaces, storage key, and the language guard live
 * in `./config`.
 *
 * **Exports:** default `i18n` instance (e.g. `ErrorBoundary` uses `i18n.t(...)` outside React) and
 * `changeAppLanguage` (used by `LanguageSwitcher`). Shared language/namespace values live in
 * `./config`.
 *
 * **Initial language:** `readInitialLanguage()` — valid `localStorage[I18N_STORAGE_KEY]` wins,
 * else first supported base tag from `navigator.language` / `navigator.languages`, else `en`.
 * **`languageChanged`** persists the chosen code and updates `document.documentElement.lang`.
 *
 * **Locale files:** co-located under `./locales/<lang>/<namespace>.json`, discovered via
 * `import.meta.glob` and assembled by `buildLocaleResources`.
 *
 * **Tests:** prefer `createTestI18n` / `renderWithI18n` from `@/test/i18nTestUtils` instead
 * of importing this module, so assertions do not mutate the app singleton.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  type SupportedLanguage,
} from "./config";
import { buildLocaleResources } from "./localeResources";

function readBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  const tags = [navigator.language, ...(navigator.languages ?? [])];
  for (const tag of tags) {
    const base = tag?.split("-")[0]?.toLowerCase();
    if (base && isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
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
  if (!isSupportedLanguage(lng)) return;
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}

/** Runtime owns the real document language; unsupported values never touch the document. */
function syncDocumentLanguage(lng: string): void {
  if (!isSupportedLanguage(lng) || typeof document === "undefined") return;
  document.documentElement.lang = lng;
}

/** Validates against the shared guard, then `i18n.changeLanguage` (persistence + html lang run in `languageChanged`). */
export function changeAppLanguage(code: string): Promise<void> {
  if (!isSupportedLanguage(code)) return Promise.resolve();
  return i18n.changeLanguage(code).then(() => undefined);
}

/**
 * Eager glob: one JSON module per locale file under `locales/<lang>/<namespace>.json`.
 * The dev-only theme gallery copy is loaded by its own dev-gated module instead.
 */
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  ["./locales/*/*.json", "!./locales/*/devThemeGallery.json"],
  { eager: true },
);

const initialLanguage = readInitialLanguage();

void i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  resources: buildLocaleResources(localeModules, NAMESPACES),
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

syncDocumentLanguage(initialLanguage);

i18n.on("languageChanged", (lng) => {
  persistLanguage(lng);
  syncDocumentLanguage(lng);
});

export default i18n;

