import { describe, it, expect } from "vitest";

import DailySalesReport from "../../src/models/dailySalesReport.ts";
import {
  calculateUsersReportBodySchema,
  dailySalesReportIdParamsSchema,
  dailySalesReportsBusinessParamsSchema,
  dailySalesReportsBusinessQuerySchema,
} from "domain/schemas/dailySalesReports";
import {
  dailySalesReportBodySchemas,
  dailySalesReportServerOwnedFields,
} from "../helpers/dailySalesReportDtos.ts";

/**
 * Parity between the dailySalesReports DTOs and the DailySalesReport model (the
 * domain source of truth): the server-owned report fields are owned by the model
 * but accepted by no document DTO, and every DTO key is either a model field or
 * an explicit read-only filter/command parameter.
 */

const VALID_ID = "507f1f77bcf86cd799439011";

const dailyReportOwns = (field: string): boolean =>
  Boolean(DailySalesReport.schema.path(field));

describe("dailySalesReports DTO ↔ model parity", () => {
  it("the model owns every declared server-owned field", () => {
    for (const field of dailySalesReportServerOwnedFields) {
      expect(
        dailyReportOwns(field),
        `${field} should be owned by DailySalesReport`,
      ).toBe(true);
    }
  });

  it("server-owned fields are accepted by no document DTO", () => {
    for (const field of dailySalesReportServerOwnedFields) {
      for (const [name, schema] of Object.entries(dailySalesReportBodySchemas)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the userIds body field is an ObjectId array, not a model field", () => {
    expect(Object.keys(calculateUsersReportBodySchema.shape)).toEqual([
      "userIds",
    ]);
    expect(dailyReportOwns("userIds")).toBe(false);
    expect(
      calculateUsersReportBodySchema.safeParse({ userIds: [VALID_ID] }).success,
    ).toBe(true);
    expect(
      calculateUsersReportBodySchema.safeParse({ userIds: ["invalid-id"] })
        .success,
    ).toBe(false);
  });

  it("the params DTOs expose only identifiers that map to model paths", () => {
    expect(Object.keys(dailySalesReportIdParamsSchema.shape)).toEqual([
      "dailySalesReportId",
    ]);
    expect(
      Object.keys(dailySalesReportsBusinessParamsSchema.shape),
    ).toEqual(["businessId"]);
    expect(dailyReportOwns("businessId")).toBe(true);
  });

  it("the query DTO exposes only read-only filters", () => {
    expect(
      Object.keys(dailySalesReportsBusinessQuerySchema.shape).sort(),
    ).toEqual([
      "dailyReferenceNumber",
      "dailyReferenceNumberFrom",
      "dailyReferenceNumberTo",
      "endDate",
      "startDate",
    ]);
    // The date filters bound the model's `createdAt` timestamp, which the client
    // may filter by but never set through a report DTO.
    expect(dailyReportOwns("startDate")).toBe(false);
    expect(dailyReportOwns("endDate")).toBe(false);
    expect(dailyReportOwns("createdAt")).toBe(true);
  });
});
