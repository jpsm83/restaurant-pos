import type { ReactElement, ReactNode } from "react";
import i18next, { type i18n } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { render, type RenderOptions } from "@testing-library/react";
import {
  DEFAULT_LANGUAGE,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  type I18nNamespace,
  type SupportedLanguage,
} from "@/i18n/config";

/** Eager locale bundles — the same JSON files as production, keyed by language and namespace. */
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../i18n/locales/*/*.json",
  { eager: true },
);

export function testResources(): Record<
  string,
  Partial<Record<I18nNamespace, Record<string, unknown>>>
> {
  const resources: Record<
    string,
    Partial<Record<I18nNamespace, Record<string, unknown>>>
  > = {};

  for (const path of Object.keys(localeModules)) {
    const match = /^\.\.\/i18n\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const lang = match[1];
    const ns = match[2] as I18nNamespace;
    if (!NAMESPACES.includes(ns)) continue;

    if (!resources[lang]) resources[lang] = {};
    resources[lang][ns] = localeModules[path].default;
  }

  return resources;
}

/**
 * Isolated i18n instance for tests (avoids mutating the app singleton from `@/i18n/i18n`).
 * Use with `I18nextProvider` or `renderWithI18n`; pass `"es"` for a Spanish render.
 */
export async function createTestI18n(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): Promise<i18n> {
  const instance = i18next.createInstance();
  instance.use(initReactI18next);
  await instance.init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    resources: testResources(),
    ns: [...NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

export type RenderWithI18nOptions = Omit<RenderOptions, "wrapper"> & {
  i18n?: i18n;
  /** Language for the isolated instance when no explicit `i18n` is supplied. */
  language?: SupportedLanguage;
  /** Outer wrapper; `I18nextProvider` is applied inside it (e.g. `QueryClientProvider`). */
  wrapper?: RenderOptions["wrapper"];
};

/**
 * `render` with an `I18nextProvider` backed by `createTestI18n()`.
 * Prefer this over `import "@/i18n/i18n"` in tests so language and resources stay isolated from the singleton.
 */
export async function renderWithI18n(
  ui: ReactElement,
  options?: RenderWithI18nOptions,
) {
  const i18nInstance =
    options?.i18n ?? (await createTestI18n(options?.language));
  const OuterWrapper = options?.wrapper;
  const rest: Omit<RenderWithI18nOptions, "i18n" | "language" | "wrapper"> = {};
  if (options) {
    const { i18n: _i, language: _l, wrapper: _w, ...r } = options;
    void _i;
    void _l;
    void _w;
    Object.assign(rest, r);
  }

  function I18nShell({ children }: { children: ReactNode }) {
    return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
  }

  const Wrapper = OuterWrapper
    ? function Composed({ children }: { children: ReactNode }) {
        return (
          <OuterWrapper>
            <I18nShell>{children}</I18nShell>
          </OuterWrapper>
        );
      }
    : I18nShell;

  return render(ui, { ...rest, wrapper: Wrapper });
}
