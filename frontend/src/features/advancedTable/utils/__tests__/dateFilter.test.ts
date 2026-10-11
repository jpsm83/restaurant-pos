import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatReadableDate,
  getQuickRange,
  isValidCalendarDate,
  parseCalendarDate,
  parseDateTime,
  resolveCalendarDateBounds,
  resolveQuickRangeSelection,
} from "../dateFilter";

describe("dateFilter utils", () => {
  it("builds date-only quick ranges for today/thisWeek/thisMonth", () => {
    const now = new Date(2026, 2, 27, 10, 15, 42); // local 2026-03-27 10:15:42

    expect(getQuickRange("today", now)).toEqual(["2026-03-27", "2026-03-27"]);
    expect(getQuickRange("thisWeek", now, { weekStartsOn: 1 })).toEqual([
      "2026-03-23",
      "2026-03-27",
    ]);
    expect(getQuickRange("thisMonth", now)).toEqual(["2026-03-01", "2026-03-27"]);
  });

  it("maps legacy quick range keys to date-only ranges", () => {
    const now = new Date(2026, 2, 27, 10, 15, 42);
    expect(getQuickRange("lastDay", now)).toEqual(["2026-03-27", "2026-03-27"]);
    expect(getQuickRange("lastHour", now)).toEqual(["2026-03-27", "2026-03-27"]);
    expect(getQuickRange("lastWeek", now, { weekStartsOn: 1 })).toEqual([
      "2026-03-23",
      "2026-03-27",
    ]);
    expect(getQuickRange("lastMonth", now)).toEqual(["2026-03-01", "2026-03-27"]);
    expect(getQuickRange("unknown", now)).toEqual(["", ""]);
  });

  it("formats and parses plain calendar dates only", () => {
    expect(formatCalendarDate(new Date(2026, 2, 27, 10, 15, 42))).toBe("2026-03-27");

    expect(isValidCalendarDate("2026-03-27")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2026-03-27T10:15:42")).toBe(false);
    expect(isValidCalendarDate("2026-03-27T10:15:42Z")).toBe(false);

    expect(isValidCalendarDate("0099-01-01")).toBe(true);
    expect(parseCalendarDate("0099-01-01")?.getFullYear()).toBe(99);

    const parsed = parseCalendarDate("2026-03-27");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(27);
    expect(parseCalendarDate("not-a-date")).toBeNull();
  });

  it("resolves the active quick range from date-only values", () => {
    expect(resolveQuickRangeSelection("2026-03-01", "2026-03-27")).toBe(
      "thisMonth",
    );
    expect(
      resolveQuickRangeSelection("2026-03-23", "2026-03-27", { weekStartsOn: 1 }),
    ).toBe("thisWeek");
    expect(resolveQuickRangeSelection("2026-03-27", "2026-03-27")).toBe("today");
    expect(resolveQuickRangeSelection("2026-03-10", "2026-03-27")).toBe("");
    expect(resolveQuickRangeSelection("bad", "2026-03-27")).toBe("");
  });

  it("resolves inclusive browser-local day bounds for local filtering", () => {
    const bounds = resolveCalendarDateBounds("2026-03-01", "2026-03-31");
    expect(bounds).not.toBeNull();
    expect(bounds?.startMs).toBe(new Date(2026, 2, 1, 0, 0, 0, 0).getTime());
    expect(bounds?.endMs).toBe(new Date(2026, 2, 31, 23, 59, 59, 999).getTime());

    expect(resolveCalendarDateBounds("bad", "2026-03-31")).toBeNull();
    expect(resolveCalendarDateBounds("2026-03-01", "2026-03-31T00:00:00")).toBeNull();
  });

  it("parses backend ISO date-time with milliseconds and timezone", () => {
    const parsed = parseDateTime("2026-03-27T10:15:42.990+00:00");
    expect(parsed).not.toBeNull();
    expect(parsed?.date.getTime()).toBeGreaterThan(0);
    expect(parsed?.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("guards invalid date-time values", () => {
    expect(parseDateTime("not-a-date")).toBeNull();
    expect(parseDateTime("2026-13-99T77:88:99")).toBeNull();
  });

  it("returns input when formatting readable invalid dates", () => {
    expect(formatReadableDate("invalid")).toBe("invalid");
  });
});
