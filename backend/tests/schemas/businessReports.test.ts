import { describe, it, expect } from "vitest";

import {
  calculateMonthlyReportQuerySchema,
  monthlyBusinessParamsSchema,
  monthlyBusinessReportListQuerySchema,
  monthlyBusinessReportRangeQuerySchema,
  monthlyReportIdParamsSchema,
  reportIncludeDeletedQuerySchema,
  updateMonthlyBusinessReportBodySchema,
  weeklyBusinessParamsSchema,
  weeklyBusinessReportListQuerySchema,
  weeklyBusinessReportRangeQuerySchema,
  weeklyReportIdParamsSchema,
} from "restaurant-pos-packages/schemas/businessReports";

const VALID_ID = "507f1f77bcf86cd799439011";

describe("weeklyReportIdParamsSchema", () => {
  it("accepts a valid ObjectId and trims it", () => {
    const parsed = weeklyReportIdParamsSchema.parse({
      weeklyReportId: `  ${VALID_ID}  `,
    });
    expect(parsed.weeklyReportId).toBe(VALID_ID);
  });

  it("rejects a missing or malformed id", () => {
    expect(weeklyReportIdParamsSchema.safeParse({}).success).toBe(false);
    expect(
      weeklyReportIdParamsSchema.safeParse({ weeklyReportId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      weeklyReportIdParamsSchema.safeParse({
        weeklyReportId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("weeklyBusinessParamsSchema", () => {
  it("accepts a valid businessId", () => {
    expect(
      weeklyBusinessParamsSchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
  });

  it("rejects a missing or malformed businessId", () => {
    expect(weeklyBusinessParamsSchema.safeParse({}).success).toBe(false);
    expect(
      weeklyBusinessParamsSchema.safeParse({ businessId: "nope" }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      weeklyBusinessParamsSchema.safeParse({
        businessId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("weeklyBusinessReportListQuerySchema", () => {
  it("accepts an empty query (every filter is optional)", () => {
    const parsed = weeklyBusinessReportListQuerySchema.parse({});
    expect(parsed.businessId).toBeUndefined();
    expect(parsed.startWeek).toBeUndefined();
    expect(parsed.endWeek).toBeUndefined();
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("accepts a businessId and a plain calendar-date week range", () => {
    const parsed = weeklyBusinessReportListQuerySchema.parse({
      businessId: VALID_ID,
      startWeek: "2024-01-01",
      endWeek: "2024-01-07",
    });
    expect(parsed.businessId).toBe(VALID_ID);
    expect(parsed.startWeek).toBe("2024-01-01");
    expect(parsed.endWeek).toBe("2024-01-07");
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("coerces includeDeleted when provided", () => {
    const parsed = weeklyBusinessReportListQuerySchema.parse({
      includeDeleted: "true",
    });
    expect(parsed.includeDeleted).toBe(true);
  });

  it("rejects a malformed businessId", () => {
    expect(
      weeklyBusinessReportListQuerySchema.safeParse({ businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed or impossible week date", () => {
    for (const value of [
      "not-a-date",
      "2024-1-01",
      "2024/01/01",
      "2024-13-01",
      "2024-02-30",
      "2024-01-01T00:00:00.000Z",
    ]) {
      expect(
        weeklyBusinessReportListQuerySchema.safeParse({ startWeek: value })
          .success,
        `startWeek=${value} should be rejected`,
      ).toBe(false);
    }
  });

  it("treats empty values as not provided", () => {
    const parsed = weeklyBusinessReportListQuerySchema.parse({
      businessId: "",
      startWeek: "   ",
      endWeek: "",
    });
    expect(parsed.businessId).toBeUndefined();
    expect(parsed.startWeek).toBeUndefined();
    expect(parsed.endWeek).toBeUndefined();
  });

  it("rejects unknown keys", () => {
    expect(
      weeklyBusinessReportListQuerySchema.safeParse({
        startWeek: "2024-01-01",
        isReportOpen: "true",
      }).success,
    ).toBe(false);
  });
});

describe("weeklyBusinessReportRangeQuerySchema", () => {
  it("accepts an empty range and a valid range", () => {
    expect(weeklyBusinessReportRangeQuerySchema.safeParse({}).success).toBe(
      true,
    );
    expect(
      weeklyBusinessReportRangeQuerySchema.safeParse({
        startWeek: "2024-01-01",
        endWeek: "2024-01-07",
        includeDeleted: "false",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed week date and unknown keys", () => {
    expect(
      weeklyBusinessReportRangeQuerySchema.safeParse({ startWeek: "nope" })
        .success,
    ).toBe(false);
    expect(
      weeklyBusinessReportRangeQuerySchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(false);
  });
});

describe("monthlyReportIdParamsSchema", () => {
  it("accepts a valid ObjectId and trims it", () => {
    const parsed = monthlyReportIdParamsSchema.parse({
      monthlyReportId: `  ${VALID_ID}  `,
    });
    expect(parsed.monthlyReportId).toBe(VALID_ID);
  });

  it("rejects a missing or malformed id and unknown keys", () => {
    expect(monthlyReportIdParamsSchema.safeParse({}).success).toBe(false);
    expect(
      monthlyReportIdParamsSchema.safeParse({ monthlyReportId: "invalid-id" })
        .success,
    ).toBe(false);
    expect(
      monthlyReportIdParamsSchema.safeParse({
        monthlyReportId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("monthlyBusinessParamsSchema", () => {
  it("accepts a valid businessId and rejects malformed input", () => {
    expect(
      monthlyBusinessParamsSchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
    expect(monthlyBusinessParamsSchema.safeParse({}).success).toBe(false);
    expect(
      monthlyBusinessParamsSchema.safeParse({ businessId: "nope", extra: 1 })
        .success,
    ).toBe(false);
  });
});

describe("monthlyBusinessReportListQuerySchema", () => {
  it("accepts an empty query", () => {
    const parsed = monthlyBusinessReportListQuerySchema.parse({});
    expect(parsed.businessId).toBeUndefined();
    expect(parsed.startMonth).toBeUndefined();
    expect(parsed.endMonth).toBeUndefined();
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("accepts a businessId and a YYYY-MM month range", () => {
    const parsed = monthlyBusinessReportListQuerySchema.parse({
      businessId: VALID_ID,
      startMonth: "2024-01",
      endMonth: "2024-12",
    });
    expect(parsed.businessId).toBe(VALID_ID);
    expect(parsed.startMonth).toBe("2024-01");
    expect(parsed.endMonth).toBe("2024-12");
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("coerces includeDeleted when provided", () => {
    const parsed = monthlyBusinessReportListQuerySchema.parse({
      includeDeleted: "true",
    });
    expect(parsed.includeDeleted).toBe(true);
  });

  it("rejects a malformed businessId", () => {
    expect(
      monthlyBusinessReportListQuerySchema.safeParse({ businessId: "bad" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed or impossible month", () => {
    for (const value of [
      "not-a-month",
      "2024-1",
      "2024/01",
      "2024-00",
      "2024-13",
      "2024-01-01",
    ]) {
      expect(
        monthlyBusinessReportListQuerySchema.safeParse({ startMonth: value })
          .success,
        `startMonth=${value} should be rejected`,
      ).toBe(false);
    }
  });

  it("treats empty values as not provided", () => {
    const parsed = monthlyBusinessReportListQuerySchema.parse({
      businessId: "",
      startMonth: "",
      endMonth: "  ",
    });
    expect(parsed.businessId).toBeUndefined();
    expect(parsed.startMonth).toBeUndefined();
    expect(parsed.endMonth).toBeUndefined();
  });

  it("rejects unknown keys", () => {
    expect(
      monthlyBusinessReportListQuerySchema.safeParse({
        startMonth: "2024-01",
        isReportOpen: "true",
      }).success,
    ).toBe(false);
  });
});

describe("monthlyBusinessReportRangeQuerySchema", () => {
  it("accepts an empty range and a valid range", () => {
    expect(monthlyBusinessReportRangeQuerySchema.safeParse({}).success).toBe(
      true,
    );
    expect(
      monthlyBusinessReportRangeQuerySchema.safeParse({
        startMonth: "2024-01",
        endMonth: "2024-06",
        includeDeleted: "false",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed month and unknown keys", () => {
    expect(
      monthlyBusinessReportRangeQuerySchema.safeParse({ endMonth: "2024-13" })
        .success,
    ).toBe(false);
    expect(
      monthlyBusinessReportRangeQuerySchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(false);
  });
});

describe("calculateMonthlyReportQuerySchema", () => {
  it("treats a missing or empty month as not provided", () => {
    expect(
      calculateMonthlyReportQuerySchema.parse({}).month,
    ).toBeUndefined();
    expect(
      calculateMonthlyReportQuerySchema.parse({ month: "" }).month,
    ).toBeUndefined();
  });

  it("accepts a YYYY-MM month", () => {
    expect(
      calculateMonthlyReportQuerySchema.parse({ month: "2024-06" }).month,
    ).toBe("2024-06");
  });

  it("rejects a malformed month and unknown keys", () => {
    expect(
      calculateMonthlyReportQuerySchema.safeParse({ month: "invalid" }).success,
    ).toBe(false);
    expect(
      calculateMonthlyReportQuerySchema.safeParse({
        month: "2024-06",
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("reportIncludeDeletedQuerySchema", () => {
  it("accepts missing includeDeleted and coerces boolean values", () => {
    expect(reportIncludeDeletedQuerySchema.parse({}).includeDeleted).toBeUndefined();
    expect(
      reportIncludeDeletedQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
  });

  it("rejects non-boolean includeDeleted values", () => {
    expect(
      reportIncludeDeletedQuerySchema.safeParse({ includeDeleted: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("updateMonthlyBusinessReportBodySchema", () => {
  it("accepts either or both cost fields", () => {
    expect(
      updateMonthlyBusinessReportBodySchema.parse({
        totalFixedOperatingCost: 1500,
      }).totalFixedOperatingCost,
    ).toBe(1500);
    expect(
      updateMonthlyBusinessReportBodySchema.parse({ totalExtraCost: 200 })
        .totalExtraCost,
    ).toBe(200);
    expect(
      updateMonthlyBusinessReportBodySchema.parse({
        totalFixedOperatingCost: 1500,
        totalExtraCost: 200,
      }),
    ).toEqual({ totalFixedOperatingCost: 1500, totalExtraCost: 200 });
  });

  it("rejects a null or numeric-string cost rather than coercing it", () => {
    for (const value of [null, "1500", "", true, []]) {
      expect(
        updateMonthlyBusinessReportBodySchema.safeParse({
          totalFixedOperatingCost: value,
        }).success,
        `totalFixedOperatingCost=${JSON.stringify(value)} should be rejected`,
      ).toBe(false);
    }
  });

  it("accepts an empty body (the at-least-one rule is a post-parse check)", () => {
    expect(updateMonthlyBusinessReportBodySchema.safeParse({}).success).toBe(
      true,
    );
  });

  it("rejects non-numeric values", () => {
    expect(
      updateMonthlyBusinessReportBodySchema.safeParse({
        totalFixedOperatingCost: "abc",
      }).success,
    ).toBe(false);
  });

  it("rejects server-owned and unknown fields", () => {
    expect(
      updateMonthlyBusinessReportBodySchema.safeParse({
        totalFixedOperatingCost: 1500,
        costBreakdown: {},
      }).success,
    ).toBe(false);
    expect(
      updateMonthlyBusinessReportBodySchema.safeParse({
        totalFixedOperatingCost: 1500,
        isReportOpen: false,
      }).success,
    ).toBe(false);
  });
});
