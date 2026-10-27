import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n/config";

export interface LanguageOption {
  value: SupportedLanguage;
  label: string;
}

/** Switcher rows: shared language codes + `common.languages.*` labels. */
export function useLanguageOptions(): LanguageOption[] {
  const { t } = useTranslation("common");
  return SUPPORTED_LANGUAGES.map((code) => ({
    value: code,
    label: t(`languages.${code}`),
  }));
}
