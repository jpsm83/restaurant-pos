const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

export type QuickRangeOption = "today" | "thisWeek" | "thisMonth";

export interface QuickRangeConfig {
  /**
   * First day of business week:
   * 0 = Sunday, 1 = Monday, ... 6 = Saturday.
   */
  weekStartsOn?: number;
}

export interface CalendarDateBounds {
  startMs: number;
  endMs: number;
}

function clampWeekStartsOn(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 1;
  return Math.min(6, Math.max(0, Math.trunc(value)));
}

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
}

function getStartOfWeek(date: Date, weekStartsOn: number): Date {
  const start = getStartOfDay(date);
  const diff = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
}

type LegacyQuickRangeOption =
  | "last15min"
  | "lastHour"
  | "lastDay"
  | "lastWeek"
  | "lastMonth";

function normalizeQuickRangeOption(option: string): QuickRangeOption | null {
  const legacyToCurrent: Record<LegacyQuickRangeOption, QuickRangeOption> = {
    last15min: "today",
    lastHour: "today",
    lastDay: "today",
    lastWeek: "thisWeek",
    lastMonth: "thisMonth",
  };
  return (
    legacyToCurrent[option as LegacyQuickRangeOption] ??
    (["today", "thisWeek", "thisMonth"].includes(option)
      ? (option as QuickRangeOption)
      : null)
  );
}

/**
 * Formats a `Date` as a plain `YYYY-MM-DD` calendar date using its browser-local
 * date components. No time or offset is emitted.
 */
export function formatCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when `value` is a real `YYYY-MM-DD` calendar date (no time, no offset). */
export function isValidCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = createCalendarDate(Number(year), Number(month), Number(day));
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

function createCalendarDate(year: number, month: number, day: number): Date {
  // `new Date(year, ...)` maps years 0-99 to 1900-1999, so set the full year
  // explicitly to preserve four-digit calendar years.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Parses a plain `YYYY-MM-DD` calendar date into a browser-local `Date` at
 * midnight. Returns `null` for any other shape, including date-times.
 */
export function parseCalendarDate(value: string): Date | null {
  if (!isValidCalendarDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return createCalendarDate(year, month, day);
}

/**
 * Resolves a quick range to a pair of plain `YYYY-MM-DD` calendar dates.
 * Sub-day legacy options collapse to `today`; the end is always the current
 * calendar date.
 */
export function getQuickRange(
  option: string,
  nowDate: Date = new Date(),
  config: QuickRangeConfig = {},
): [string, string] {
  const normalizedOption = normalizeQuickRangeOption(option);
  if (!normalizedOption) return ["", ""];

  const now = new Date(nowDate.getTime());
  let start: Date;
  switch (normalizedOption) {
    case "today":
      start = getStartOfDay(now);
      break;
    case "thisWeek":
      start = getStartOfWeek(now, clampWeekStartsOn(config.weekStartsOn));
      break;
    case "thisMonth":
      start = getStartOfMonth(now);
      break;
    default:
      return ["", ""];
  }

  return [formatCalendarDate(start), formatCalendarDate(now)];
}

export function resolveQuickRangeSelection(
  startDateStr: string,
  endDateStr: string,
  config: QuickRangeConfig = {},
): QuickRangeOption | "" {
  const start = parseCalendarDate(startDateStr);
  const end = parseCalendarDate(endDateStr);
  if (!start || !end) return "";

  const startKey = formatCalendarDate(start);

  // "Today", "This week", and "This month" are anchored by period start.
  const todayStartKey = formatCalendarDate(getStartOfDay(end));
  const weekStartKey = formatCalendarDate(
    getStartOfWeek(end, clampWeekStartsOn(config.weekStartsOn)),
  );
  const monthStartKey = formatCalendarDate(getStartOfMonth(end));

  if (startKey === monthStartKey) return "thisMonth";
  if (startKey === weekStartKey) return "thisWeek";
  if (startKey === todayStartKey) return "today";

  return "";
}

/**
 * Resolves a date-only range to inclusive browser-local `[start, end]` day
 * bounds for client-side filtering. Business-local resolution to UTC bounds is
 * owned by the backend; this is the local-mode fallback.
 */
export function resolveCalendarDateBounds(
  startDateStr: string,
  endDateStr: string,
): CalendarDateBounds | null {
  const start = parseCalendarDate(startDateStr);
  const end = parseCalendarDate(endDateStr);
  if (!start || !end) return null;

  const endOfDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
    23,
    59,
    59,
    999,
  );
  return { startMs: start.getTime(), endMs: endOfDay.getTime() };
}

/**
 * Parses a backend date-time string into a `Date` plus its browser-local wall
 * time. Used to display and locally compare record timestamps; business-local
 * display is out of scope for the date-only filter contract.
 */
export function parseDateTime(
  dateTimeStr: string,
): { date: Date; time: string } | null {
  // Support backend ISO strings with milliseconds/timezone first
  // (e.g. 2026-03-27T10:15:42.990+00:00).
  const isoDate = new Date(dateTimeStr);
  if (!Number.isNaN(isoDate.getTime())) {
    const time = [
      String(isoDate.getHours()).padStart(2, "0"),
      String(isoDate.getMinutes()).padStart(2, "0"),
      String(isoDate.getSeconds()).padStart(2, "0"),
    ].join(":");
    return { date: isoDate, time };
  }

  const match = DATE_TIME_PATTERN.exec(dateTimeStr);
  if (!match) return null;

  const [, y, m, d, hh, mm, ss] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const hours = Number(hh);
  const minutes = Number(mm);
  const seconds = Number(ss);

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds
  ) {
    return null;
  }

  return { date, time: `${hh}:${mm}:${ss}` };
}

/** Formats a `YYYY-MM-DD` value or `Date` for display, returning the input when invalid. */
export function formatReadableDate(
  value: string | Date,
  locale = "es-ES",
): string {
  const date = value instanceof Date ? value : parseCalendarDate(value);
  if (!date) return String(value);

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
