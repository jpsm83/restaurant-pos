import { describe, it, expect, afterEach } from "vitest";

import {
  resolveDayBounds,
  resolveLocalDate,
  resolveWeekBounds,
  resolveMonthBounds,
} from "../../src/utils/timezoneResolver.ts";

const iso = (date: Date): string => date.toISOString();

describe("resolveLocalDate", () => {
  it("maps an instant to the calendar date west of UTC (previous day)", () => {
    expect(
      resolveLocalDate(new Date("2024-01-01T03:00:00Z"), "America/Bogota"),
    ).toBe("2023-12-31");
  });

  it("maps an instant to the calendar date east of UTC (next day)", () => {
    expect(
      resolveLocalDate(new Date("2024-01-01T20:00:00Z"), "Asia/Tokyo"),
    ).toBe("2024-01-02");
  });

  it("respects a non-hour offset zone", () => {
    expect(
      resolveLocalDate(new Date("2024-06-15T23:30:00Z"), "Asia/Kathmandu"),
    ).toBe("2024-06-16");
  });

  it("uses the offset in effect before a spring-forward transition", () => {
    expect(
      resolveLocalDate(
        new Date("2024-03-10T07:30:00Z"),
        "America/Los_Angeles",
      ),
    ).toBe("2024-03-09");
  });

  it("uses the offset in effect after a spring-forward transition", () => {
    expect(
      resolveLocalDate(
        new Date("2024-03-11T06:30:00Z"),
        "America/Los_Angeles",
      ),
    ).toBe("2024-03-10");
  });
});

describe("resolveDayBounds", () => {
  it("resolves a west-of-UTC zone-day to its UTC instants", () => {
    const bounds = resolveDayBounds("2024-01-15", "America/Bogota");
    expect(iso(bounds.start)).toBe("2024-01-15T05:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-01-16T04:59:59.999Z");
  });

  it("resolves an east-of-UTC zone-day to its UTC instants", () => {
    const bounds = resolveDayBounds("2024-01-15", "Asia/Tokyo");
    expect(iso(bounds.start)).toBe("2024-01-14T15:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-01-15T14:59:59.999Z");
  });

  it("handles a 23-hour day when the clock springs forward", () => {
    const bounds = resolveDayBounds("2024-03-10", "America/Los_Angeles");
    expect(iso(bounds.start)).toBe("2024-03-10T08:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-03-11T06:59:59.999Z");
  });

  it("handles a 25-hour day when the clock falls back", () => {
    const bounds = resolveDayBounds("2024-11-03", "America/Los_Angeles");
    expect(iso(bounds.start)).toBe("2024-11-03T07:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-11-04T07:59:59.999Z");
  });

  it("starts at the shifted time when local midnight is skipped", () => {
    const bounds = resolveDayBounds("2018-11-04", "America/Sao_Paulo");
    expect(iso(bounds.start)).toBe("2018-11-04T03:00:00.000Z");
    expect(iso(bounds.end)).toBe("2018-11-05T01:59:59.999Z");
  });

  it("rejects a calendar date wholly skipped in the zone", () => {
    expect(() =>
      resolveDayBounds("2011-12-30", "Pacific/Apia"),
    ).toThrow(RangeError);
  });

  it("rejects a malformed calendar date", () => {
    expect(() => resolveDayBounds("2024-3-10", "UTC")).toThrow(RangeError);
    expect(() => resolveDayBounds("2024-02-30", "UTC")).toThrow(RangeError);
  });
});

describe("resolveWeekBounds", () => {
  it("resolves a Monday-start week in a west-of-UTC zone", () => {
    const bounds = resolveWeekBounds("2024-03-13", "America/Los_Angeles", 1);
    expect(iso(bounds.start)).toBe("2024-03-11T07:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-03-18T06:59:59.999Z");
  });

  it("resolves a Sunday-start week across a spring-forward transition", () => {
    const bounds = resolveWeekBounds("2024-03-13", "America/Los_Angeles", 0);
    expect(iso(bounds.start)).toBe("2024-03-10T08:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-03-17T06:59:59.999Z");
  });

  it("resolves a week that crosses a month boundary", () => {
    const bounds = resolveWeekBounds("2024-05-01", "America/Los_Angeles", 1);
    expect(iso(bounds.start)).toBe("2024-04-29T07:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-05-06T06:59:59.999Z");
  });

  it("resolves a week that crosses a year boundary", () => {
    const bounds = resolveWeekBounds("2025-01-01", "America/Los_Angeles", 1);
    expect(iso(bounds.start)).toBe("2024-12-30T08:00:00.000Z");
    expect(iso(bounds.end)).toBe("2025-01-06T07:59:59.999Z");
  });

  it("resolves an east-of-UTC week", () => {
    const bounds = resolveWeekBounds("2024-03-13", "Asia/Tokyo", 1);
    expect(iso(bounds.start)).toBe("2024-03-10T15:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-03-17T14:59:59.999Z");
  });

  it("rejects an out-of-range weekly start day", () => {
    expect(() => resolveWeekBounds("2024-03-13", "UTC", 7)).toThrow(RangeError);
    expect(() => resolveWeekBounds("2024-03-13", "UTC", -1)).toThrow(RangeError);
  });
});

describe("resolveMonthBounds", () => {
  it("resolves a west-of-UTC month, including a leap day", () => {
    const bounds = resolveMonthBounds("2024-02-15", "America/Bogota");
    expect(iso(bounds.start)).toBe("2024-02-01T05:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-03-01T04:59:59.999Z");
  });

  it("resolves a month containing a spring-forward transition", () => {
    const bounds = resolveMonthBounds("2024-03-15", "America/Los_Angeles");
    expect(iso(bounds.start)).toBe("2024-03-01T08:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-04-01T06:59:59.999Z");
  });

  it("resolves an east-of-UTC month", () => {
    const bounds = resolveMonthBounds("2024-01-15", "Asia/Tokyo");
    expect(iso(bounds.start)).toBe("2023-12-31T15:00:00.000Z");
    expect(iso(bounds.end)).toBe("2024-01-31T14:59:59.999Z");
  });
});

describe("server timezone independence", () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  });

  function sample(): string[] {
    return [
      iso(resolveDayBounds("2024-03-10", "America/Los_Angeles").start),
      iso(resolveDayBounds("2018-11-04", "America/Sao_Paulo").start),
      iso(resolveDayBounds("2018-11-04", "America/Sao_Paulo").end),
      iso(resolveWeekBounds("2024-03-13", "America/Los_Angeles", 0).start),
      iso(resolveMonthBounds("2024-02-15", "America/Bogota").end),
      resolveLocalDate(new Date("2024-01-01T03:00:00Z"), "America/Bogota"),
      resolveLocalDate(new Date("2024-01-01T20:00:00Z"), "Asia/Tokyo"),
    ];
  }

  it("produces identical results whatever the server's OS timezone is", () => {
    const osOffset = (): number =>
      new Date("2024-01-01T00:00:00Z").getTimezoneOffset();

    process.env.TZ = "UTC";
    const utcOffset = osOffset();
    const inUtc = sample();

    process.env.TZ = "Pacific/Kiritimati";
    const kiritimatiOffset = osOffset();
    const inKiritimati = sample();

    process.env.TZ = "Pacific/Midway";
    const midwayOffset = osOffset();
    const inMidway = sample();

    // The OS timezone really did change, so the equality below is meaningful.
    expect(kiritimatiOffset).not.toBe(utcOffset);
    expect(midwayOffset).not.toBe(utcOffset);

    expect(inKiritimati).toEqual(inUtc);
    expect(inMidway).toEqual(inUtc);
    expect(inUtc).toEqual([
      "2024-03-10T08:00:00.000Z",
      "2018-11-04T03:00:00.000Z",
      "2018-11-05T01:59:59.999Z",
      "2024-03-10T08:00:00.000Z",
      "2024-03-01T04:59:59.999Z",
      "2023-12-31",
      "2024-01-02",
    ]);
  });
});
