/**
 * Business-local timezone math.
 *
 * A "calendar date" here is a plain `YYYY-MM-DD` — the local date a business
 * sees — and every operation resolves against an explicit IANA zone. All work
 * is done with the platform's `Intl` facilities (Node ships full ICU); there is
 * no runtime date dependency.
 *
 * The module never reads the server's operating-system timezone, so results are
 * identical wherever the process runs. It is the single seam all zone math
 * flows through.
 */

/** A plain calendar date in `YYYY-MM-DD` form. */
export type CalendarDate = string;

/** A closed UTC interval: `start` and `end` are both inclusive instants. */
export interface DateBounds {
  start: Date;
  end: Date;
}

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Formatters are pure functions of their arguments, so memoizing them by zone
 * changes nothing about the results — it only avoids rebuilding an
 * `Intl.DateTimeFormat` on every field read.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The zone-local wall-clock fields of an instant. */
function localFieldsAt(
  instantMs: number,
  timeZone: string,
): CivilDate & { hour: number; minute: number; second: number } {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function parseCalendarDate(value: CalendarDate): CivilDate {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  const civil = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (
    civil.month < 1 ||
    civil.month > 12 ||
    civil.day < 1 ||
    civil.day > daysInMonth(civil.year, civil.month)
  ) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return civil;
}

function formatCalendarDate({ year, month, day }: CivilDate): CalendarDate {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day of week for a civil date; `0` = Sunday … `6` = Saturday. */
function weekdayOf({ year, month, day }: CivilDate): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Shift a civil date by whole days, using UTC arithmetic only. */
function addDays({ year, month, day }: CivilDate, days: number): CivilDate {
  const shifted = new Date(
    Date.UTC(year, month - 1, day) + days * MS_PER_DAY,
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function isOnOrAfterLocalDate(
  instantMs: number,
  target: CivilDate,
  timeZone: string,
): boolean {
  const local = localFieldsAt(instantMs, timeZone);
  if (local.year !== target.year) return local.year > target.year;
  if (local.month !== target.month) return local.month > target.month;
  return local.day >= target.day;
}

/**
 * The first UTC instant whose zone-local calendar date is `civil`.
 *
 * A zone-local date is monotonic: it never moves backwards as time advances, so
 * a binary search over a window that provably brackets the boundary finds the
 * exact transition. This is what makes a skipped local midnight (the clock
 * jumps straight from 23:59 to 01:00) resolve to the shifted start rather than
 * an instant that belongs to the previous day.
 */
function startOfLocalDayMs(civil: CivilDate, timeZone: string): number {
  const utcMidnight = Date.UTC(civil.year, civil.month - 1, civil.day);
  let low = utcMidnight - 24 * MS_PER_HOUR;
  let high = utcMidnight + 48 * MS_PER_HOUR;
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (isOnOrAfterLocalDate(mid, civil, timeZone)) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
}

/**
 * The inclusive `[start, end]` UTC instants spanning the local dates from
 * `startCivil` through `endCivil`. Throws when the span is empty — a whole
 * local date skipped by a dateline/DST shift has no representable interval.
 */
function localDateRange(
  startCivil: CivilDate,
  endCivil: CivilDate,
  timeZone: string,
): DateBounds {
  const start = startOfLocalDayMs(startCivil, timeZone);
  const end = startOfLocalDayMs(addDays(endCivil, 1), timeZone) - 1;
  if (end < start) {
    throw new RangeError(
      `Calendar date does not exist in ${timeZone}: ${formatCalendarDate(startCivil)}`,
    );
  }
  return { start: new Date(start), end: new Date(end) };
}

/**
 * Resolve a plain calendar date in a zone to that zone-day's `[start, end]`
 * UTC instants. Both bounds are inclusive; `start` is the first instant of the
 * local day and `end` is its last millisecond.
 */
export function resolveDayBounds(
  calendarDate: CalendarDate,
  timeZone: string,
): DateBounds {
  const civil = parseCalendarDate(calendarDate);
  return localDateRange(civil, civil, timeZone);
}

/** Resolve a UTC instant to the local calendar date in a zone. */
export function resolveLocalDate(
  instant: Date,
  timeZone: string,
): CalendarDate {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new TypeError("resolveLocalDate expects a valid Date");
  }
  return formatCalendarDate(localFieldsAt(instant.getTime(), timeZone));
}

/**
 * Resolve the local week containing a date to its inclusive `[start, end]` UTC
 * instants, for the given `weekStartsOn` day (`0` = Sunday … `6` = Saturday).
 */
export function resolveWeekBounds(
  calendarDate: CalendarDate,
  timeZone: string,
  weekStartsOn: number,
): DateBounds {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError(`Invalid week start day: ${weekStartsOn}`);
  }
  const civil = parseCalendarDate(calendarDate);
  const daysSinceStart = (weekdayOf(civil) - weekStartsOn + 7) % 7;
  const start = addDays(civil, -daysSinceStart);
  const end = addDays(start, 6);
  return localDateRange(start, end, timeZone);
}

/**
 * Resolve the local month containing a date to its inclusive `[start, end]`
 * UTC instants.
 */
export function resolveMonthBounds(
  calendarDate: CalendarDate,
  timeZone: string,
): DateBounds {
  const civil = parseCalendarDate(calendarDate);
  const start = { ...civil, day: 1 };
  const end = {
    ...civil,
    day: daysInMonth(civil.year, civil.month),
  };
  return localDateRange(start, end, timeZone);
}

/**
 * The UTC instant at midnight for a plain calendar date. This is the canonical
 * `Date` a calendar date is stored as: it is zone-independent, so a given date
 * maps to the same instant wherever the process runs.
 */
export function calendarDateToUtcMidnight(
  calendarDate: CalendarDate,
): Date {
  const civil = parseCalendarDate(calendarDate);
  return new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
}

/** Shift a plain calendar date by whole days. */
export function addDaysToCalendarDate(
  calendarDate: CalendarDate,
  days: number,
): CalendarDate {
  return formatCalendarDate(addDays(parseCalendarDate(calendarDate), days));
}

/** Shift a plain calendar date by whole months. */
export function addMonthsToCalendarDate(
  calendarDate: CalendarDate,
  months: number,
): CalendarDate {
  const civil = parseCalendarDate(calendarDate);
  const shifted = new Date(
    Date.UTC(civil.year, civil.month - 1 + months, civil.day),
  );
  return formatCalendarDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** The number of days in the zone-independent month of a calendar date. */
export function daysInCalendarMonth(calendarDate: CalendarDate): number {
  const civil = parseCalendarDate(calendarDate);
  return daysInMonth(civil.year, civil.month);
}
