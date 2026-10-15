import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Business from "../../src/models/business.ts";
import {
  businessIdParamsSchema,
  createBusinessBodySchema,
  discoverBusinessesQuerySchema,
  updateBusinessBodySchema,
} from "domain/schemas/business";

/**
 * Parity between the business DTOs and the Mongoose Business model (the domain
 * source of truth): every domain field a client may send must exist on the
 * model, and every server-owned field must exist on the model but never in a
 * DTO.
 */

/** Fields that are request-only and intentionally absent from the model. */
const REQUEST_ONLY_FIELDS = new Set(["imageUrl"]);

const allDtos: Record<string, z.ZodObject> = {
  createBusinessBodySchema,
  updateBusinessBodySchema,
  businessIdParamsSchema,
  discoverBusinessesQuerySchema,
};

const businessOwns = (field: string): boolean =>
  Boolean(Business.schema.path(field));

describe("business DTO ↔ model parity", () => {
  it("every create/update body field maps to a Business model field", () => {
    for (const schema of [createBusinessBodySchema, updateBusinessBodySchema]) {
      for (const key of Object.keys(schema.shape)) {
        if (REQUEST_ONLY_FIELDS.has(key)) continue;
        expect(
          businessOwns(key),
          `${key} should map to a Business model field`,
        ).toBe(true);
      }
    }
  });

  it("averageRating / ratingCount are owned by Business but in no DTO", () => {
    for (const field of ["averageRating", "ratingCount"]) {
      expect(businessOwns(field)).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("server-owned auth/session fields are in no DTO", () => {
    const serverOwned = [
      "timezone",
      "emailVerified",
      "refreshSessionVersion",
      "verificationToken",
      "resetPasswordToken",
      "resetPasswordExpires",
    ];
    for (const field of serverOwned) {
      expect(businessOwns(field), `${field} should be on the model`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the update DTO carries no credential fields", () => {
    const updateKeys = Object.keys(updateBusinessBodySchema.shape);
    for (const field of ["email", "password", "currentPassword"]) {
      expect(updateKeys).not.toContain(field);
    }
  });
});
