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
} from "restaurant-pos-packages/schemas/businessReports";
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
          schema.safeParse({ [field]: "__probe__" }).success,
          `${name} should reject server-owned field ${field}`,
        ).toBe(false);
      }
    }
  });

  it("the params DTOs expose only identifiers that map to model paths", () => {
    expect(
      weeklyReportIdParamsSchema.safeParse({
        weeklyReportId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(true);
    expect(
      weeklyReportIdParamsSchema.safeParse({
        weeklyReportId: "507f1f77bcf86cd799439011",
        extra: "x",
      }).success,
    ).toBe(false);
    expect(
      weeklyBusinessParamsSchema.safeParse({
        businessId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(true);
    expect(
      weeklyBusinessParamsSchema.safeParse({
        businessId: "507f1f77bcf86cd799439011",
        extra: "x",
      }).success,
    ).toBe(false);
    expect(weeklyOwns("businessId")).toBe(true);
  });

  it("the query DTOs expose only read-only filters", () => {
    expect(
      weeklyBusinessReportListQuerySchema.safeParse({
        businessId: "507f1f77bcf86cd799439011",
        startWeek: "2024-01-01",
        endWeek: "2024-01-07",
        includeDeleted: "true",
      }).success,
    ).toBe(true);
    expect(
      weeklyBusinessReportListQuerySchema.safeParse({
        startWeek: "2024-01-01",
        isReportOpen: "true",
      }).success,
    ).toBe(false);
    expect(
      weeklyBusinessReportRangeQuerySchema.safeParse({
        startWeek: "2024-01-01",
        endWeek: "2024-01-07",
        includeDeleted: "false",
      }).success,
    ).toBe(true);
    expect(
      weeklyBusinessReportRangeQuerySchema.safeParse({
        startWeek: "2024-01-01",
        businessId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(false);
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
          schema.safeParse({ [field]: "__probe__" }).success,
          `${name} should reject server-owned field ${field}`,
        ).toBe(false);
      }
    }
  });

  it("the params DTOs expose only identifiers that map to model paths", () => {
    expect(
      monthlyReportIdParamsSchema.safeParse({
        monthlyReportId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(true);
    expect(
      monthlyReportIdParamsSchema.safeParse({
        monthlyReportId: "507f1f77bcf86cd799439011",
        extra: "x",
      }).success,
    ).toBe(false);
    expect(
      monthlyBusinessParamsSchema.safeParse({
        businessId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(true);
    expect(
      monthlyBusinessParamsSchema.safeParse({
        businessId: "507f1f77bcf86cd799439011",
        extra: "x",
      }).success,
    ).toBe(false);
    expect(monthlyOwns("businessId")).toBe(true);
  });

  it("the query DTOs expose only read-only filters", () => {
    expect(
      monthlyBusinessReportListQuerySchema.safeParse({
        businessId: "507f1f77bcf86cd799439011",
        startMonth: "2024-01",
        endMonth: "2024-02",
        includeDeleted: "true",
      }).success,
    ).toBe(true);
    expect(
      monthlyBusinessReportListQuerySchema.safeParse({
        startMonth: "2024-01",
        isReportOpen: "true",
      }).success,
    ).toBe(false);
    expect(
      monthlyBusinessReportRangeQuerySchema.safeParse({
        startMonth: "2024-01",
        endMonth: "2024-02",
        includeDeleted: "false",
      }).success,
    ).toBe(true);
    expect(
      monthlyBusinessReportRangeQuerySchema.safeParse({
        startMonth: "2024-01",
        businessId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(false);
    expect(
      calculateMonthlyReportQuerySchema.safeParse({
        month: "2024-06",
      }).success,
    ).toBe(true);
    expect(
      calculateMonthlyReportQuerySchema.safeParse({
        month: "2024-06",
        extra: "x",
      }).success,
    ).toBe(false);
    // The month filters bound the model's `monthReference` timestamp, which the
    // client may filter by but never set through a report DTO.
    expect(monthlyOwns("startMonth")).toBe(false);
    expect(monthlyOwns("endMonth")).toBe(false);
    expect(monthlyOwns("month")).toBe(false);
    expect(monthlyOwns("monthReference")).toBe(true);
  });

  it("the PATCH body's costs map to nested model paths", () => {
    expect(
      updateMonthlyBusinessReportBodySchema.safeParse({
        totalFixedOperatingCost: 1500,
        totalExtraCost: 200,
      }).success,
    ).toBe(true);
    for (const key of ["totalFixedOperatingCost", "totalExtraCost"] as const) {
      expect(
        monthlyOwns(`costBreakdown.${key}`),
        `costBreakdown.${key} should map to a model field`,
      ).toBe(true);
    }
  });
});
