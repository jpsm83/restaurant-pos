/**
 * Plain `YYYY-MM-DD` calendar-date helpers — the machine-facing date form.
 *
 * These values carry no time-of-day or offset. Parsing builds a browser-local
 * midnight so the calendar day never shifts across a timezone. Display
 * formatting lives in `@/lib/formatting`.
 */

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

/**
 * Parses a plain `YYYY-MM-DD` calendar date into a browser-local `Date` at
 * midnight. Returns `null` for any other shape, including date-times.
 */
export function parseCalendarDate(value: string): Date | null {
  if (!isValidCalendarDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return createCalendarDate(year, month, day);
}

function createCalendarDate(year: number, month: number, day: number): Date {
  // `new Date(year, ...)` maps years 0-99 to 1900-1999, so set the full year
  // explicitly to preserve four-digit calendar years.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}
