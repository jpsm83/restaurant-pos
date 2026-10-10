import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Rating from "../../src/models/rating.ts";
import Business from "../../src/models/business.ts";
import {
  createRatingBodySchema,
  ratingIdParamsSchema,
  ratingsByBusinessParamsSchema,
} from "../../../packages/schemas/ratings.ts";

/**
 * Parity between the ratings DTOs and the Mongoose models (the domain source of
 * truth): every domain field a client may send must exist on a model, and every
 * server-owned field must exist on a model but never in a DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createRatingBodySchema,
  ratingIdParamsSchema,
  ratingsByBusinessParamsSchema,
};

const VALID_ID = "507f1f77bcf86cd799439011";

const ratingOwns = (field: string): boolean => Boolean(Rating.schema.path(field));

const businessOwns = (field: string): boolean =>
  Boolean(Business.schema.path(field));

describe("ratings DTO ↔ model parity", () => {
  it("every create-rating field maps to a Rating model field", () => {
    for (const key of Object.keys(createRatingBodySchema.shape)) {
      expect(ratingOwns(key), `createRating.${key} should map to a model field`).toBe(
        true,
      );
    }
  });

  it("userId is owned by Rating but accepted by no DTO", () => {
    expect(ratingOwns("userId")).toBe(true);
    for (const [name, schema] of Object.entries(allDtos)) {
      expect(Object.keys(schema.shape), `${name} should not accept userId`).not.toContain(
        "userId",
      );
    }
  });

  it("cached averageRating / ratingCount are owned by Business but in no DTO", () => {
    expect(businessOwns("averageRating")).toBe(true);
    expect(businessOwns("ratingCount")).toBe(true);
    for (const [name, schema] of Object.entries(allDtos)) {
      const keys = Object.keys(schema.shape);
      expect(keys, `${name} should not accept averageRating`).not.toContain(
        "averageRating",
      );
      expect(keys, `${name} should not accept ratingCount`).not.toContain(
        "ratingCount",
      );
    }
  });

  it("the DTO and the Rating model agree on the 0..5 score bound", () => {
    const scorePath = Rating.schema.path("score") as unknown as {
      options?: { min?: number | [number, string]; max?: number | [number, string] };
    };
    const bound = (value?: number | [number, string]): number | undefined =>
      Array.isArray(value) ? value[0] : value;
    const modelMin = bound(scorePath.options?.min)!;
    const modelMax = bound(scorePath.options?.max)!;

    expect(createRatingBodySchema.safeParse({ businessId: VALID_ID, score: modelMin }).success).toBe(
      true,
    );
    expect(createRatingBodySchema.safeParse({ businessId: VALID_ID, score: modelMax }).success).toBe(
      true,
    );
    expect(
      createRatingBodySchema.safeParse({ businessId: VALID_ID, score: modelMax + 0.1 }).success,
    ).toBe(false);
    expect(
      createRatingBodySchema.safeParse({ businessId: VALID_ID, score: modelMin - 0.1 }).success,
    ).toBe(false);
  });
});
