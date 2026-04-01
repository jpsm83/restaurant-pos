import { describe, expect, it } from "vitest";
import {
  buildDateTimeFromDateAndTime,
  formatLocalDateTime,
  formatReadableDateTime,
  getQuickRange,
  isValidTimeString,
  parseDateTime,
} from "../dateFilter";

describe("dateFilter utils", () => {
  it("builds quick ranges for lastHour/today/thisWeek/thisMonth", () => {
    const now = new Date(2026, 2, 27, 10, 15, 42); // local 2026-03-27 10:15:42

    const [lastHourStart, lastHourEnd] = getQuickRange("lastHour", now);
    const [todayStart, todayEnd] = getQuickRange("today", now);
    const [thisWeekStart, thisWeekEnd] = getQuickRange("thisWeek", now, {
      weekStartsOn: 1,
    });
    const [thisMonthStart, thisMonthEnd] = getQuickRange("thisMonth", now);

    expect(lastHourStart).toBe("2026-03-27T09:15:42");
    expect(lastHourEnd).toBe("2026-03-27T10:15:42");

    expect(todayStart).toBe("2026-03-27T00:00:00");
    expect(todayEnd).toBe("2026-03-27T10:15:42");

    expect(thisWeekStart).toBe("2026-03-23T00:00:00");
    expect(thisWeekEnd).toBe("2026-03-27T10:15:42");

    expect(thisMonthStart).toBe("2026-03-01T00:00:00");
    expect(thisMonthEnd).toBe("2026-03-27T10:15:42");
  });

  it("supports legacy quick range keys for compatibility", () => {
    const now = new Date(2026, 2, 27, 10, 15, 42);
    const [start, end] = getQuickRange("lastDay", now);
    expect(start).toBe("2026-03-27T00:00:00");
    expect(end).toBe("2026-03-27T10:15:42");
  });

  it("round-trips local date time format and parse", () => {
    const value = formatLocalDateTime(new Date(2026, 2, 27, 10, 15, 42));
    expect(value).toBe("2026-03-27T10:15:42");

    const parsed = parseDateTime(value);
    expect(parsed).not.toBeNull();
    expect(parsed?.time).toBe("10:15:42");
    expect(formatLocalDateTime(parsed?.date as Date)).toBe(value);
  });

  it("parses backend ISO date-time with milliseconds and timezone", () => {
    const parsed = parseDateTime("2026-03-27T10:15:42.990+00:00");
    expect(parsed).not.toBeNull();
    expect(parsed?.date.getTime()).toBeGreaterThan(0);
    expect(parsed?.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("guards invalid date and malformed times", () => {
    expect(parseDateTime("not-a-date")).toBeNull();
    expect(parseDateTime("2026-13-99T77:88:99")).toBeNull();

    expect(isValidTimeString("12:34:56")).toBe(true);
    expect(isValidTimeString("99:99:99")).toBe(false);

    const merged = buildDateTimeFromDateAndTime(
      new Date(2026, 2, 27, 0, 0, 0),
      "invalid",
      "23:59:59",
    );
    expect(merged).toBe("2026-03-27T23:59:59");
  });

  it("returns input when formatting readable invalid values", () => {
    expect(formatReadableDateTime("invalid")).toBe("invalid");
  });
});
