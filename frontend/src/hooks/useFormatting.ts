import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "date-fns/locale";
import type { SupportedLanguage } from "@/i18n/config";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  getDateFnsLocale,
  resolveFormattingLanguage,
  type DisplayDateInput,
} from "@/lib/formatting";

export interface LocaleFormatters {
  language: SupportedLanguage;
  dateFnsLocale: Locale;
  formatDate: (value: DisplayDateInput) => string;
  formatDateTime: (value: DisplayDateInput) => string;
  formatNumber: (value: number) => string;
  formatCurrency: (
    value: number,
    currency: string | null | undefined,
  ) => string;
}

/**
 * Formatters bound to the active i18next language. Subscribing through
 * `useTranslation` re-renders consumers when the language changes.
 */
export function useFormatting(): LocaleFormatters {
  const { i18n } = useTranslation();
  const language = resolveFormattingLanguage(i18n.language);

  return useMemo(
    () => ({
      language,
      dateFnsLocale: getDateFnsLocale(language),
      formatDate: (value) => formatDate(value, language),
      formatDateTime: (value) => formatDateTime(value, language),
      formatNumber: (value) => formatNumber(value, language),
      formatCurrency: (value, currency) =>
        formatCurrency(value, currency, language),
    }),
    [language],
  );
}
