/**
 * Locale-aware **display formatting** — dates, date-times, numbers, and money.
 *
 * Every helper takes the active UI language explicitly. Currency helpers also
 * take the Business currency; the UI language only changes presentation, never
 * the currency code or the stored amount. Machine-facing values (API payloads,
 * date inputs, exports) stay ISO/`YYYY-MM-DD`; this module only produces copy
 * for display.
 *
 * React consumers use `useFormatting` from `@/hooks/useFormatting` so a language
 * change re-renders formatted output immediately.
 */
import { enUS, es as esLocale, type Locale } from "date-fns/locale";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n/config";
import { parseCalendarDate } from "@/lib/calendarDate";

export type DisplayDateInput = Date | string;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: "2-digit",
  minute: "2-digit",
};

/** Normalizes an i18next language tag to a supported display language. */
export function resolveFormattingLanguage(
  language: string | null | undefined,
): SupportedLanguage {
  const base = language?.split("-")[0]?.toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base ?? "")
    ? (base as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

const DATE_FNS_LOCALES: Record<SupportedLanguage, Locale> = {
  en: enUS,
  es: esLocale,
};

/** date-fns locale data for the active UI language (calendar month/weekday names). */
export function getDateFnsLocale(language: SupportedLanguage): Locale {
  return DATE_FNS_LOCALES[language];
}

/** Formats a calendar date for display in the active UI language. */
export function formatDate(
  value: DisplayDateInput,
  language: SupportedLanguage,
): string {
  const date = parseDisplayDate(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat(language, DATE_OPTIONS).format(date);
}

/** Formats a date-time for display in the active UI language. */
export function formatDateTime(
  value: DisplayDateInput,
  language: SupportedLanguage,
): string {
  const date = parseDisplayDate(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat(language, DATE_TIME_OPTIONS).format(date);
}

/** Formats a number with the active UI language's grouping and decimal marks. */
export function formatNumber(value: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(language).format(value);
}

/**
 * Formats an amount as money using the explicit Business currency.
 *
 * A missing/blank currency falls back to plain number formatting instead of
 * inventing one. An unsupported currency code does the same rather than
 * throwing into a render path.
 */
export function formatCurrency(
  value: number,
  currency: string | null | undefined,
  language: SupportedLanguage,
): string {
  const code = currency?.trim();
  if (!code) return formatNumber(value, language);

  try {
    return new Intl.NumberFormat(language, {
      style: "currency",
      currency: code,
    }).format(value);
  } catch {
    return formatNumber(value, language);
  }
}

function parseDisplayDate(value: DisplayDateInput): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Date-only strings are calendar dates parsed at local midnight, so display
  // never shifts the day across a timezone.
  const calendarDate = parseCalendarDate(value);
  if (calendarDate) return calendarDate;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
