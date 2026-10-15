import { describe, it, expect } from "vitest";

import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.ts";
import MonthlyBusinessReport from "../../src/models/monthlyBusinessReport.ts";
import {
  calculateMonthlyReportQuerySchema,
  monthlyBusinessParamsSchema,
  monthlyBusinessReportListQuerySchema,
  monthlyBusinessReportRangeQuerySchema,
  monthlyReportIdParamsSchema,
  updateMonthlyBusinessReportBodySchema,
  weeklyBusinessParamsSchema,
  weeklyBusinessReportListQuerySchema,
  weeklyBusinessReportRangeQuerySchema,
  weeklyReportIdParamsSchema,
} from "domain/schemas/businessReports";
import {
  businessReportBodySchemas,
  monthlyBusinessReportServerOwnedFields,
  weeklyBusinessReportServerOwnedFields,
} from "../helpers/businessReportDtos.ts";

/**
 * Parity between the business-report DTOs and the Weekly/MonthlyBusinessReport
 * models (the domain source of truth): every declared server-owned field is
 * owned by its model but accepted by no body DTO, every DTO key is either a
 * model field or an explicit read-only filter/command parameter, and the monthly
 * PATCH body's client-settable costs map to nested model paths.
 */

/** Whether a model owns a field directly or as a nested-object parent path. */
const ownsPath = (
  paths: Record<string, unknown>,
  field: string,
): boolean =>
  Boolean(paths[field]) ||
  Object.keys(paths).some((path) => path.startsWith(`${field}.`));

const weeklyPaths = WeeklyBusinessReport.schema.paths as Record<string, unknown>;
const monthlyPaths = MonthlyBusinessReport.schema.paths as Record<
  string,
  unknown
>;

const weeklyOwns = (field: string): boolean => ownsPath(weeklyPaths, field);

const monthlyOwns = (field: string): boolean => ownsPath(monthlyPaths, field);

describe("weekly business report DTO ↔ model parity", () => {
  it("the model owns every declared server-owned field", () => {
    for (const field of weeklyBusinessReportServerOwnedFields) {
      expect(
        weeklyOwns(field),
        `${field} should be owned by WeeklyBusinessReport`,
      ).toBe(true);
    }
  });

  it("server-owned fields are accepted by no document DTO", () => {
    for (const field of weeklyBusinessReportServerOwnedFields) {
      for (const [name, schema] of Object.entries(businessReportBodySchemas)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the params DTOs expose only identifiers that map to model paths", () => {
    expect(Object.keys(weeklyReportIdParamsSchema.shape)).toEqual([
      "weeklyReportId",
    ]);
    expect(Object.keys(weeklyBusinessParamsSchema.shape)).toEqual(["businessId"]);
    expect(weeklyOwns("businessId")).toBe(true);
  });

  it("the query DTOs expose only read-only filters", () => {
    expect(
      Object.keys(weeklyBusinessReportListQuerySchema.shape).sort(),
    ).toEqual(["businessId", "endWeek", "startWeek"]);
    expect(
      Object.keys(weeklyBusinessReportRangeQuerySchema.shape).sort(),
    ).toEqual(["endWeek", "startWeek"]);
    // The week filters bound the model's `weekReference` timestamp, which the
    // client may filter by but never set through a report DTO.
    expect(weeklyOwns("startWeek")).toBe(false);
    expect(weeklyOwns("endWeek")).toBe(false);
    expect(weeklyOwns("weekReference")).toBe(true);
  });
});

describe("monthly business report DTO ↔ model parity", () => {
  it("the model owns every declared server-owned field", () => {
    for (const field of monthlyBusinessReportServerOwnedFields) {
      expect(
        monthlyOwns(field),
        `${field} should be owned by MonthlyBusinessReport`,
      ).toBe(true);
    }
  });

  it("server-owned fields are accepted by no document DTO", () => {
    for (const field of monthlyBusinessReportServerOwnedFields) {
      for (const [name, schema] of Object.entries(businessReportBodySchemas)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the params DTOs expose only identifiers that map to model paths", () => {
    expect(Object.keys(monthlyReportIdParamsSchema.shape)).toEqual([
      "monthlyReportId",
    ]);
    expect(Object.keys(monthlyBusinessParamsSchema.shape)).toEqual([
      "businessId",
    ]);
    expect(monthlyOwns("businessId")).toBe(true);
  });

  it("the query DTOs expose only read-only filters", () => {
    expect(
      Object.keys(monthlyBusinessReportListQuerySchema.shape).sort(),
    ).toEqual(["businessId", "endMonth", "startMonth"]);
    expect(
      Object.keys(monthlyBusinessReportRangeQuerySchema.shape).sort(),
    ).toEqual(["endMonth", "startMonth"]);
    expect(
      Object.keys(calculateMonthlyReportQuerySchema.shape),
    ).toEqual(["month"]);
    // The month filters bound the model's `monthReference` timestamp, which the
    // client may filter by but never set through a report DTO.
    expect(monthlyOwns("startMonth")).toBe(false);
    expect(monthlyOwns("endMonth")).toBe(false);
    expect(monthlyOwns("month")).toBe(false);
    expect(monthlyOwns("monthReference")).toBe(true);
  });

  it("the PATCH body's costs map to nested model paths", () => {
    const keys = Object.keys(updateMonthlyBusinessReportBodySchema.shape).sort();
    expect(keys).toEqual(["totalExtraCost", "totalFixedOperatingCost"]);
    for (const key of keys) {
      expect(
        monthlyOwns(`costBreakdown.${key}`),
        `costBreakdown.${key} should map to a model field`,
      ).toBe(true);
    }
  });
});
