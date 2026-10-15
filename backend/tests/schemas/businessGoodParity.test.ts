import { describe, it, expect } from "vitest";
import type { z } from "zod";

import BusinessGood from "../../src/models/businessGood.ts";
import {
  businessGoodByBusinessParamsSchema,
  businessGoodIdParamsSchema,
  createBusinessGoodBodySchema,
  updateBusinessGoodBodySchema,
} from "domain/schemas/businessGood";

/**
 * Parity between the businessGood DTOs and the Mongoose BusinessGood model (the
 * domain source of truth): every domain field a client may send must exist on
 * the model, and every server-owned field must exist on the model but never in
 * a DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createBusinessGoodBodySchema,
  updateBusinessGoodBodySchema,
  businessGoodIdParamsSchema,
  businessGoodByBusinessParamsSchema,
};

const businessGoodOwns = (field: string): boolean =>
  Boolean(BusinessGood.schema.path(field));

describe("businessGood DTO ↔ model parity", () => {
  it("every create/update body field maps to a BusinessGood model field", () => {
    for (const schema of [
      createBusinessGoodBodySchema,
      updateBusinessGoodBodySchema,
    ]) {
      for (const key of Object.keys(schema.shape)) {
        expect(
          businessGoodOwns(key),
          `${key} should map to a BusinessGood model field`,
        ).toBe(true);
      }
    }
  });

  it("the create DTO requires businessId while the update DTO omits it", () => {
    expect(businessGoodOwns("businessId")).toBe(true);
    expect(Object.keys(createBusinessGoodBodySchema.shape)).toContain(
      "businessId",
    );
    expect(Object.keys(updateBusinessGoodBodySchema.shape)).not.toContain(
      "businessId",
    );
    expect(
      updateBusinessGoodBodySchema.safeParse({
        name: "Burger",
        keyword: "burger",
        mainCategory: "Food",
        onMenu: "true",
        available: "true",
        sellingPrice: "10",
      }).success,
    ).toBe(true);
  });

  it("server-owned fields are on the model but in no DTO", () => {
    for (const field of ["costPrice", "suggestedSellingPrice", "imagesUrl"]) {
      expect(businessGoodOwns(field), `${field} should be on the model`).toBe(
        true,
      );
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the nested ingredient DTO maps to the model's ingredients field", () => {
    expect(businessGoodOwns("ingredients")).toBe(true);
    expect(businessGoodOwns("setMenuIds")).toBe(true);
  });
});
