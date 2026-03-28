import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { US, ES } from "country-flag-icons/react/3x2";

export type LanguageFlagProps = { className?: string; title?: string };

/** i18n language code + ISO 3166-1 alpha-2 country code for `country-flag-icons` (3×2). */
export const SUPPORTED_LANGUAGES = [
  { code: "en", flagCountryCode: "US" },
  { code: "es", flagCountryCode: "ES" },
] as const satisfies readonly { code: string; flagCountryCode: string }[];

export interface LanguageOption {
  value: string;
  label: string;
}

const FLAG_BY_COUNTRY = {
  US,
  ES,
} as const satisfies Record<
  (typeof SUPPORTED_LANGUAGES)[number]["flagCountryCode"],
  ComponentType<LanguageFlagProps>
>;

const FLAG_BY_LANG_CODE: Record<
  (typeof SUPPORTED_LANGUAGES)[number]["code"],
  ComponentType<LanguageFlagProps>
> = {
  en: FLAG_BY_COUNTRY.US,
  es: FLAG_BY_COUNTRY.ES,
};

/** Options for the language switcher: stable codes + native names from `common` namespace. */
export const useLanguageOptions = (): LanguageOption[] => {
  const { t } = useTranslation("common");

  return SUPPORTED_LANGUAGES.map(({ code }) => ({
    value: code,
    label: t(`languages.${code}`),
  }));
};

/** Maps UI / i18n language code to a flag component. Unknown codes fall back to US (English). */
export const getLanguageFlag = (
  languageCode: string,
): ComponentType<LanguageFlagProps> => {
  const key = languageCode.toLowerCase() as keyof typeof FLAG_BY_LANG_CODE;
  return FLAG_BY_LANG_CODE[key] ?? FLAG_BY_COUNTRY.US;
};
