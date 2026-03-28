import type { ReactElement, ReactNode } from "react";
import i18next, { type i18n } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { render, type RenderOptions } from "@testing-library/react";
import auth from "@/i18n/locales/en/auth.json";
import business from "@/i18n/locales/en/business.json";
import common from "@/i18n/locales/en/common.json";
import customer from "@/i18n/locales/en/customer.json";
import employee from "@/i18n/locales/en/employee.json";
import errors from "@/i18n/locales/en/errors.json";
import marketing from "@/i18n/locales/en/marketing.json";
import mode from "@/i18n/locales/en/mode.json";
import nav from "@/i18n/locales/en/nav.json";

/** Mirrors `frontend/src/i18n/index.ts` namespaces for tests that assert English UI copy. */
export const TEST_I18N_NAMESPACES = [
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

export type TestI18nNamespace = (typeof TEST_I18N_NAMESPACES)[number];

/** English locale bundles — same JSON files as production `en` (single source of truth). */
export function englishTestResources(): Record<
  "en",
  Record<TestI18nNamespace, Record<string, unknown>>
> {
  return {
    en: {
      common: common as Record<string, unknown>,
      nav: nav as Record<string, unknown>,
      auth: auth as Record<string, unknown>,
      marketing: marketing as Record<string, unknown>,
      business: business as Record<string, unknown>,
      customer: customer as Record<string, unknown>,
      employee: employee as Record<string, unknown>,
      mode: mode as Record<string, unknown>,
      errors: errors as Record<string, unknown>,
    },
  };
}

/**
 * Isolated i18n instance for tests (avoids mutating the app singleton from `@/i18n`).
 * Use with `I18nextProvider` or `renderWithI18n`.
 */
export async function createTestI18n(): Promise<i18n> {
  const instance = i18next.createInstance();
  instance.use(initReactI18next);
  await instance.init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    resources: englishTestResources(),
    ns: [...TEST_I18N_NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

export type RenderWithI18nOptions = Omit<RenderOptions, "wrapper"> & {
  i18n?: i18n;
  /** Outer wrapper; `I18nextProvider` is applied inside it (e.g. `QueryClientProvider`). */
  wrapper?: RenderOptions["wrapper"];
};

/**
 * `render` with an `I18nextProvider` backed by `createTestI18n()`.
 * Prefer this over `import "@/i18n"` in tests so language and resources stay isolated from the singleton.
 */
export async function renderWithI18n(
  ui: ReactElement,
  options?: RenderWithI18nOptions,
) {
  const i18nInstance = options?.i18n ?? (await createTestI18n());
  const OuterWrapper = options?.wrapper;
  const rest: Omit<RenderWithI18nOptions, "i18n" | "wrapper"> = {};
  if (options) {
    const { i18n: _i, wrapper: _w, ...r } = options;
    void _i;
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
