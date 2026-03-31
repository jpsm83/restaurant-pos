import { useTranslation } from "react-i18next";

/** Initial `lng` is resolved in `i18n/i18n.ts`: saved key → browser language → `en`. */

export const SUPPORTED_LANGUAGES = [
  { code: "en" },
  { code: "es" },
] as const;

export interface LanguageOption {
  value: string;
  label: string;
}

/** Switcher rows: codes + `common.languages.*` labels. */
export function useLanguageOptions(): LanguageOption[] {
  const { t } = useTranslation("common");
  return SUPPORTED_LANGUAGES.map(({ code }) => ({
    value: code,
    label: t(`languages.${code}`),
  }));
}
