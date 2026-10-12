import { describe, it, expect } from "vitest";
import type { z } from "zod";

import SupplierGood from "../../src/models/supplierGood.ts";
import {
  createSupplierGoodBodySchema,
  supplierGoodBySupplierParamsSchema,
  supplierGoodIdParamsSchema,
  updateSupplierGoodBodySchema,
} from "../../../packages/schemas/supplierGood.ts";

/**
 * Parity between the supplierGood DTOs and the Mongoose SupplierGood model (the
 * domain source of truth): every domain field a client may send must exist on
 * the model, and every server-owned field must exist on the model but never in
 * a DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createSupplierGoodBodySchema,
  updateSupplierGoodBodySchema,
  supplierGoodIdParamsSchema,
  supplierGoodBySupplierParamsSchema,
};

const supplierGoodOwns = (field: string): boolean =>
  Boolean(SupplierGood.schema.path(field));

describe("supplierGood DTO ↔ model parity", () => {
  it("every create/update body field maps to a SupplierGood model field", () => {
    for (const schema of [
      createSupplierGoodBodySchema,
      updateSupplierGoodBodySchema,
    ]) {
      for (const key of Object.keys(schema.shape)) {
        expect(
          supplierGoodOwns(key),
          `${key} should map to a SupplierGood model field`,
        ).toBe(true);
      }
    }
  });

  it("create requires supplierId and businessId while update omits them", () => {
    expect(supplierGoodOwns("supplierId")).toBe(true);
    expect(supplierGoodOwns("businessId")).toBe(true);
    expect(Object.keys(createSupplierGoodBodySchema.shape)).toContain(
      "supplierId",
    );
    expect(Object.keys(createSupplierGoodBodySchema.shape)).toContain(
      "businessId",
    );
    expect(Object.keys(updateSupplierGoodBodySchema.shape)).not.toContain(
      "supplierId",
    );
    expect(Object.keys(updateSupplierGoodBodySchema.shape)).not.toContain(
      "businessId",
    );
  });

  it("server-owned fields are on the model but in no DTO", () => {
    for (const field of ["imagesUrl", "pricePerMeasurementUnit"]) {
      expect(
        supplierGoodOwns(field),
        `${field} should be on the model`,
      ).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("currentlyInUse is client-settable on update but not on create", () => {
    expect(supplierGoodOwns("currentlyInUse")).toBe(true);
    expect(Object.keys(updateSupplierGoodBodySchema.shape)).toContain(
      "currentlyInUse",
    );
    expect(Object.keys(createSupplierGoodBodySchema.shape)).not.toContain(
      "currentlyInUse",
    );
  });
});
