import { describe, it, expect } from "vitest";
import type { z } from "zod";

import SalesPoint from "../../src/models/salesPoint.ts";
import { salesPointTypeEnums } from "restaurant-pos-packages/enums";
import {
  createSalesPointBodySchema,
  salesPointIdParamsSchema,
  salesPointsIncludeDeletedQuerySchema,
  updateSalesPointBodySchema,
} from "restaurant-pos-packages/schemas/salesPoints";

/**
 * Parity between the salesPoints DTOs and the SalesPoint model (the domain
 * source of truth): every field a client may send must exist on the model, and
 * every server-owned field must exist on the model but never in a DTO.
 */

const VALID_ID = "507f1f77bcf86cd799439011";

const salesPointOwns = (field: string): boolean =>
  Boolean(SalesPoint.schema.path(field));

const allDtos: Record<string, z.ZodObject> = {
  createSalesPointBodySchema,
  salesPointIdParamsSchema,
  updateSalesPointBodySchema,
  salesPointsIncludeDeletedQuerySchema,
};

describe("salesPoints DTO ↔ model parity", () => {
  it("every create-salesPoint field maps to a SalesPoint model field", () => {
    for (const key of Object.keys(createSalesPointBodySchema.shape)) {
      expect(
        salesPointOwns(key),
        `createSalesPoint.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every update-salesPoint field maps to a SalesPoint model field", () => {
    for (const key of Object.keys(updateSalesPointBodySchema.shape)) {
      expect(
        salesPointOwns(key),
        `updateSalesPoint.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("qrCode is owned by SalesPoint but accepted by no DTO", () => {
    expect(salesPointOwns("qrCode")).toBe(true);
    for (const [name, schema] of Object.entries(allDtos)) {
      expect(
        Object.keys(schema.shape),
        `${name} should not accept qrCode`,
      ).not.toContain("qrCode");
    }
  });

  it("the DTO salesPointType accepts every value of the shared enum", () => {
    for (const type of salesPointTypeEnums) {
      const result = createSalesPointBodySchema.safeParse({
        salesPointName: "Table 1",
        businessId: VALID_ID,
        salesPointType: type,
      });
      expect(result.success, `salesPointType ${type} should be accepted`).toBe(
        true,
      );
    }
  });

  it("the query DTO exposes only includeDeleted", () => {
    expect(Object.keys(salesPointsIncludeDeletedQuerySchema.shape)).toEqual([
      "includeDeleted",
    ]);
  });

  it("the DTO salesPointType rejects a value outside the shared enum", () => {
    const result = createSalesPointBodySchema.safeParse({
      salesPointName: "Table 1",
      businessId: VALID_ID,
      salesPointType: "not-a-type",
    });
    expect(result.success).toBe(false);
  });
});
