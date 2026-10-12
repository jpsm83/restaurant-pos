import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Supplier from "../../src/models/supplier.ts";
import {
  createSupplierBodySchema,
  supplierByBusinessParamsSchema,
  supplierIdParamsSchema,
  updateSupplierBodySchema,
} from "../../../packages/schemas/supplier.ts";

/**
 * Parity between the supplier DTOs and the Mongoose Supplier model (the domain
 * source of truth): every domain field a client may send must exist on the
 * model, and every server-owned field must exist on the model but never in a
 * DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createSupplierBodySchema,
  updateSupplierBodySchema,
  supplierIdParamsSchema,
  supplierByBusinessParamsSchema,
};

const supplierOwns = (field: string): boolean =>
  Boolean(Supplier.schema.path(field));

describe("supplier DTO ↔ model parity", () => {
  it("every create/update body field maps to a Supplier model field", () => {
    for (const schema of [createSupplierBodySchema, updateSupplierBodySchema]) {
      for (const key of Object.keys(schema.shape)) {
        expect(
          supplierOwns(key),
          `${key} should map to a Supplier model field`,
        ).toBe(true);
      }
    }
  });

  it("the create DTO requires businessId while the update DTO omits it", () => {
    expect(supplierOwns("businessId")).toBe(true);
    expect(Object.keys(createSupplierBodySchema.shape)).toContain("businessId");
    expect(Object.keys(updateSupplierBodySchema.shape)).not.toContain(
      "businessId",
    );
  });

  it("server-owned imageUrl is on the model but in no DTO", () => {
    expect(supplierOwns("imageUrl")).toBe(true);
    for (const [name, schema] of Object.entries(allDtos)) {
      expect(
        Object.keys(schema.shape),
        `${name} should not accept imageUrl`,
      ).not.toContain("imageUrl");
    }
  });

  it("the address DTO maps to the model's address field", () => {
    expect(supplierOwns("address")).toBe(true);
  });
});
