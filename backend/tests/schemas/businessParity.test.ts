import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Business from "../../src/models/business.ts";
import {
  businessIdParamsSchema,
  discoverBusinessesQuerySchema,
  updateBusinessBodySchema,
} from "restaurant-pos-packages/schemas/business";

/**
 * Parity between the business DTOs and the Mongoose Business model (the domain
 * source of truth): every domain field a client may send must exist on the
 * model, and every server-owned field must exist on the model but never in a
 * DTO.
 */

/** Fields that are request-only and intentionally absent from the model. */
const REQUEST_ONLY_FIELDS = new Set(["imageUrl"]);

const allDtos: Record<string, z.ZodObject> = {
  updateBusinessBodySchema,
  businessIdParamsSchema,
  discoverBusinessesQuerySchema,
};

const businessOwns = (field: string): boolean =>
  Boolean(Business.schema.path(field));

describe("business DTO ↔ model parity", () => {
  it("every update body field maps to a Business model field", () => {
    for (const key of Object.keys(updateBusinessBodySchema.shape)) {
      if (REQUEST_ONLY_FIELDS.has(key)) continue;
      expect(
        businessOwns(key),
        `${key} should map to a Business model field`,
      ).toBe(true);
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

  it("server-owned venue fields are in no DTO", () => {
    for (const field of ["timezone", "emailVerified"]) {
      expect(businessOwns(field), `${field} should be on the model`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("Business carries no credential or session-generation fields", () => {
    for (const field of [
      "password",
      "verificationToken",
      "resetPasswordToken",
      "resetPasswordExpires",
      "pendingEmail",
      "pendingEmailToken",
      "pendingEmailExpires",
      "refreshSessionVersion",
    ]) {
      expect(businessOwns(field), `${field} should be gone`).toBe(false);
    }
  });

  it("the update DTO carries no sign-in credential fields", () => {
    const updateKeys = Object.keys(updateBusinessBodySchema.shape);
    for (const field of ["password", "currentPassword"]) {
      expect(updateKeys).not.toContain(field);
    }
  });
});
