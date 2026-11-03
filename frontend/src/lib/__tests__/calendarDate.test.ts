import { describe, expect, it } from "vitest";
import { calendarDatePart } from "../calendarDate";

describe("calendarDatePart", () => {
  it("keeps a plain calendar date", () => {
    expect(calendarDatePart("2026-03-27")).toBe("2026-03-27");
  });

  it("takes the calendar day from an API date-time", () => {
    expect(calendarDatePart("2026-03-27T22:15:42.000Z")).toBe("2026-03-27");
  });

  it("rejects values without a real leading calendar date", () => {
    expect(calendarDatePart("2026-02-30T00:00:00.000Z")).toBeNull();
    expect(calendarDatePart("not-a-date")).toBeNull();
    expect(calendarDatePart("")).toBeNull();
  });
});
