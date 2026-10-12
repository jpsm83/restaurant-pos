import { describe, it, expect } from "vitest";

import {
  calculateUsersReportBodySchema,
  dailySalesReportIdParamsSchema,
  dailySalesReportsBusinessParamsSchema,
  dailySalesReportsBusinessQuerySchema,
} from "restaurant-pos-packages/schemas/dailySalesReports";
import {
  dailySalesReportBodySchemas,
  dailySalesReportServerOwnedFields,
} from "../helpers/dailySalesReportDtos.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const SECOND_ID = "507f1f77bcf86cd799439022";

describe("dailySalesReportIdParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(
      dailySalesReportIdParamsSchema.safeParse({
        dailySalesReportId: VALID_ID,
      }).success,
    ).toBe(true);
  });

  it("trims the id", () => {
    const parsed = dailySalesReportIdParamsSchema.parse({
      dailySalesReportId: `  ${VALID_ID}  `,
    });
    expect(parsed.dailySalesReportId).toBe(VALID_ID);
  });

  it("rejects a missing or malformed id", () => {
    expect(dailySalesReportIdParamsSchema.safeParse({}).success).toBe(false);
    expect(
      dailySalesReportIdParamsSchema.safeParse({
        dailySalesReportId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      dailySalesReportIdParamsSchema.safeParse({
        dailySalesReportId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("dailySalesReportsBusinessParamsSchema", () => {
  it("accepts a valid businessId", () => {
    expect(
      dailySalesReportsBusinessParamsSchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(true);
  });

  it("rejects a missing or malformed businessId", () => {
    expect(dailySalesReportsBusinessParamsSchema.safeParse({}).success).toBe(
      false,
    );
    expect(
      dailySalesReportsBusinessParamsSchema.safeParse({ businessId: "nope" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      dailySalesReportsBusinessParamsSchema.safeParse({
        businessId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("calculateUsersReportBodySchema", () => {
  it("accepts a non-empty ObjectId array", () => {
    const parsed = calculateUsersReportBodySchema.parse({
      userIds: [VALID_ID, SECOND_ID],
    });
    expect(parsed.userIds).toEqual([VALID_ID, SECOND_ID]);
  });

  it("requires a non-empty userIds array", () => {
    expect(calculateUsersReportBodySchema.safeParse({}).success).toBe(false);
    expect(
      calculateUsersReportBodySchema.safeParse({ userIds: [] }).success,
    ).toBe(false);
  });

  it("rejects a malformed ObjectId in the array", () => {
    expect(
      calculateUsersReportBodySchema.safeParse({
        userIds: [VALID_ID, "invalid-id"],
      }).success,
    ).toBe(false);
  });

  it("rejects server-owned fields", () => {
    for (const serverOwned of [
      { dailyReferenceNumber: 1001 },
      { isDailyReportOpen: false },
      { employeesDailySalesReport: [] },
    ]) {
      expect(
        calculateUsersReportBodySchema.safeParse({
          userIds: [VALID_ID],
          ...serverOwned,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown keys", () => {
    expect(
      calculateUsersReportBodySchema.safeParse({
        userIds: [VALID_ID],
        isAdmin: true,
      }).success,
    ).toBe(false);
  });
});

describe("dailySalesReportsBusinessQuerySchema", () => {
  it("accepts an empty query (every filter is optional)", () => {
    const parsed = dailySalesReportsBusinessQuerySchema.parse({});
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.endDate).toBeUndefined();
    expect(parsed.dailyReferenceNumber).toBeUndefined();
    expect(parsed.dailyReferenceNumberFrom).toBeUndefined();
    expect(parsed.dailyReferenceNumberTo).toBeUndefined();
  });

  it("coerces reference numbers from their query string form into integers", () => {
    const parsed = dailySalesReportsBusinessQuerySchema.parse({
      dailyReferenceNumber: "1002",
      dailyReferenceNumberFrom: "1000",
      dailyReferenceNumberTo: "2000",
    });
    expect(parsed.dailyReferenceNumber).toBe(1002);
    expect(parsed.dailyReferenceNumberFrom).toBe(1000);
    expect(parsed.dailyReferenceNumberTo).toBe(2000);
  });

  it("rejects non-integer reference numbers", () => {
    for (const value of ["abc", "1.2", "NaN"]) {
      expect(
        dailySalesReportsBusinessQuerySchema.safeParse({
          dailyReferenceNumber: value,
        }).success,
      ).toBe(false);
    }
  });

  it("treats an empty reference number as not provided", () => {
    expect(
      dailySalesReportsBusinessQuerySchema.parse({ dailyReferenceNumber: "" })
        .dailyReferenceNumber,
    ).toBeUndefined();
  });

  it("accepts a plain calendar date and passes it through unchanged", () => {
    const parsed = dailySalesReportsBusinessQuerySchema.parse({
      startDate: "2026-10-11",
      endDate: "2026-10-12",
    });
    expect(parsed.startDate).toBe("2026-10-11");
    expect(parsed.endDate).toBe("2026-10-12");
  });

  it("rejects a date-time string with an offset", () => {
    expect(
      dailySalesReportsBusinessQuerySchema.safeParse({
        startDate: "2026-10-11T15:30:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      dailySalesReportsBusinessQuerySchema.safeParse({
        endDate: "2026-10-11T15:30:00+02:00",
      }).success,
    ).toBe(false);
  });

  it("rejects an offset-less date-time string", () => {
    expect(
      dailySalesReportsBusinessQuerySchema.safeParse({
        startDate: "2026-10-11T15:30:00",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed or impossible calendar date", () => {
    for (const value of [
      "not-a-date",
      "2026-3-10",
      "2026/10/11",
      "2026-13-01",
      "2026-02-30",
    ]) {
      expect(
        dailySalesReportsBusinessQuerySchema.safeParse({ startDate: value })
          .success,
      ).toBe(false);
    }
  });

  it("treats an empty date as not provided", () => {
    const parsed = dailySalesReportsBusinessQuerySchema.parse({
      startDate: "   ",
      endDate: "",
    });
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.endDate).toBeUndefined();
  });

  it("rejects unknown keys", () => {
    expect(
      dailySalesReportsBusinessQuerySchema.safeParse({
        startDate: "2026-10-11",
        isDailyReportOpen: "true",
      }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every document DTO", () => {
  it.each(Object.entries(dailySalesReportBodySchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      for (const field of dailySalesReportServerOwnedFields) {
        expect(keys).not.toContain(field);
      }
    },
  );
});
