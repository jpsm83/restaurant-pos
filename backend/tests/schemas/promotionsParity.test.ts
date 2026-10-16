import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Promotion from "../../src/models/promotion.ts";
import { weekDaysEnums } from "restaurant-pos-packages/enums";
import {
  createPromotionBodySchema,
  promotionIdParamsSchema,
  promotionsByBusinessParamsSchema,
  updatePromotionBodySchema,
} from "restaurant-pos-packages/schemas/promotions";

/**
 * Parity between the promotions DTOs and the Promotion model (the domain source
 * of truth): every field a client may send must exist on the model, and every
 * server-owned field must exist on the model but never in a DTO.
 */

const VALID_ID = "507f1f77bcf86cd799439011";

const promotionOwns = (field: string): boolean =>
  Boolean(Promotion.schema.path(field));

const allDtos: Record<string, z.ZodObject> = {
  createPromotionBodySchema,
  promotionIdParamsSchema,
  updatePromotionBodySchema,
  promotionsByBusinessParamsSchema,
};

describe("promotions DTO ↔ model parity", () => {
  it("every create-promotion field maps to a Promotion model field", () => {
    for (const key of Object.keys(createPromotionBodySchema.shape)) {
      expect(
        promotionOwns(key),
        `createPromotion.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every update-promotion field maps to a Promotion model field", () => {
    for (const key of Object.keys(updatePromotionBodySchema.shape)) {
      expect(
        promotionOwns(key),
        `updatePromotion.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by Promotion but accepted by no DTO", () => {
    for (const field of ["createdAt", "updatedAt"]) {
      expect(promotionOwns(field), `${field} should be owned by Promotion`).toBe(
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

  it("the DTO weekDays accepts every value of the shared enum", () => {
    const result = createPromotionBodySchema.safeParse({
      promotionName: "Happy Hour",
      promotionPeriod: { start: "2024-01-01", end: "2024-12-31" },
      weekDays: weekDaysEnums,
      activePromotion: true,
      promotionType: { fixedPrice: 9.99 },
      businessId: VALID_ID,
    });
    expect(result.success).toBe(true);
  });

  it("the DTO weekDays rejects a value outside the shared enum", () => {
    const result = createPromotionBodySchema.safeParse({
      promotionName: "Happy Hour",
      promotionPeriod: { start: "2024-01-01", end: "2024-12-31" },
      weekDays: ["Funday"],
      activePromotion: true,
      promotionType: { fixedPrice: 9.99 },
      businessId: VALID_ID,
    });
    expect(result.success).toBe(false);
  });

  it("the DTO promotionType covers every pricing key of the model", () => {
    const pricingKeys = [
      "fixedPrice",
      "discountPercent",
      "twoForOne",
      "threeForTwo",
      "secondHalfPrice",
      "fullComplimentary",
    ];
    for (const key of pricingKeys) {
      expect(
        promotionOwns(`promotionType.${key}`),
        `promotionType.${key} should be owned by Promotion`,
      ).toBe(true);
    }
  });
});
