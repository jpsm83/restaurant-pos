const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

export const DEFAULT_TIMES = {
  start: "00:00:00",
  end: "23:59:59",
} as const;

export type QuickRangeOption = "lastHour" | "today" | "thisWeek" | "thisMonth";

export interface QuickRangeConfig {
  /**
   * First day of business week:
   * 0 = Sunday, 1 = Monday, ... 6 = Saturday.
   */
  weekStartsOn?: number;
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

export type LegacyQuickRangeOption =
  | "last15min"
  | "lastHour"
  | "lastDay"
  | "lastWeek"
  | "lastMonth";

function normalizeQuickRangeOption(option: string): QuickRangeOption | null {
  const legacyToCurrent: Record<LegacyQuickRangeOption, QuickRangeOption> = {
    last15min: "lastHour",
    lastHour: "lastHour",
    lastDay: "today",
    lastWeek: "thisWeek",
    lastMonth: "thisMonth",
  };
  return (
    legacyToCurrent[option as LegacyQuickRangeOption] ??
    (["lastHour", "today", "thisWeek", "thisMonth"].includes(option)
      ? (option as QuickRangeOption)
      : null)
  );
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function isValidTimeString(time: string): boolean {
  return TIME_PATTERN.test(time);
}

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
    case "lastHour":
      start = new Date(now.getTime() - 60 * 60 * 1000);
      break;
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

  return [formatLocalDateTime(start), formatLocalDateTime(now)];
}

export function resolveQuickRangeSelection(
  startDateStr: string,
  endDateStr: string,
  config: QuickRangeConfig = {},
): QuickRangeOption | "" {
  const parsedStart = parseDateTime(startDateStr);
  const parsedEnd = parseDateTime(endDateStr);
  if (!parsedStart || !parsedEnd) return "";

  const start = parsedStart.date;
  const end = parsedEnd.date;
  const startKey = formatLocalDateTime(start);

  // "Today", "This week", and "This month" are anchored by period start.
  const todayStartKey = formatLocalDateTime(getStartOfDay(end));
  const weekStartKey = formatLocalDateTime(
    getStartOfWeek(end, clampWeekStartsOn(config.weekStartsOn)),
  );
  const monthStartKey = formatLocalDateTime(getStartOfMonth(end));

  if (startKey === monthStartKey) return "thisMonth";
  if (startKey === weekStartKey) return "thisWeek";
  if (startKey === todayStartKey) return "today";

  // Last hour is duration-based relative to selected range.
  const diffMs = end.getTime() - start.getTime();
  if (diffMs === 60 * 60 * 1000) return "lastHour";

  return "";
}

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

export function buildDateTimeFromDateAndTime(
  date: Date,
  time: string,
  fallbackTime: string,
): string {
  const safeTime = isValidTimeString(time) ? time : fallbackTime;
  const [hours, minutes, seconds] = safeTime.split(":").map(Number);
  const merged = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    seconds,
  );
  return formatLocalDateTime(merged);
}

export function formatReadableDateTime(
  dateTimeStr: string,
  locale = "es-ES",
): string {
  const parsed = parseDateTime(dateTimeStr);
  if (!parsed) return dateTimeStr;

  return parsed.date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
