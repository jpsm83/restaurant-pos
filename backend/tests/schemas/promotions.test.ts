import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  createPromotionBodySchema,
  promotionIdParamsSchema,
  promotionsByBusinessParamsSchema,
  promotionsByBusinessQuerySchema,
  updatePromotionBodySchema,
} from "restaurant-pos-packages/schemas/promotions";
import { weekDaysEnums } from "restaurant-pos-packages/enums";

const VALID_ID = "507f1f77bcf86cd799439011";

const valid = {
  promotionName: "Happy Hour",
  promotionPeriod: { start: "2024-01-01", end: "2024-12-31" },
  weekDays: ["Monday", "Tuesday"],
  activePromotion: true,
  promotionType: { fixedPrice: 9.99 },
  businessId: VALID_ID,
};

describe("createPromotionBodySchema", () => {
  it("accepts the minimum required fields", () => {
    expect(createPromotionBodySchema.safeParse(valid).success).toBe(true);
  });

  it("sanitizes the promotionName (HTML stripped, whitespace collapsed)", () => {
    const parsed = createPromotionBodySchema.parse({
      ...valid,
      promotionName: "  <b>Happy</b>   Hour  ",
    });
    expect(parsed.promotionName).toBe("Happy Hour");
  });

  it("requires promotionName, promotionPeriod, weekDays, activePromotion, promotionType and businessId", () => {
    expect(createPromotionBodySchema.safeParse({}).success).toBe(false);
    for (const key of [
      "promotionName",
      "promotionPeriod",
      "weekDays",
      "activePromotion",
      "promotionType",
      "businessId",
    ]) {
      const without = { ...valid } as Record<string, unknown>;
      delete without[key];
      expect(
        createPromotionBodySchema.safeParse(without).success,
        `${key} should be required`,
      ).toBe(false);
    }
  });

  it("rejects an empty promotionName", () => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, promotionName: "   " })
        .success,
    ).toBe(false);
  });

  it("coerces the promotion period to Dates", () => {
    const parsed = createPromotionBodySchema.parse(valid);
    expect(parsed.promotionPeriod.start).toBeInstanceOf(Date);
    expect(parsed.promotionPeriod.end).toBeInstanceOf(Date);
  });

  it("accepts a promotion period where start is not before end (rule enforced post-parse)", () => {
    const parsed = createPromotionBodySchema.parse({
      ...valid,
      promotionPeriod: { start: "2024-12-31", end: "2024-01-01" },
    });
    expect(parsed.promotionPeriod.start).toBeInstanceOf(Date);
    expect(parsed.promotionPeriod.end).toBeInstanceOf(Date);
  });

  it("rejects a malformed promotion period", () => {
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        promotionPeriod: { start: "not-a-date", end: "2024-12-31" },
      }).success,
    ).toBe(false);
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        promotionPeriod: { start: "2024-01-01" },
      }).success,
    ).toBe(false);
  });

  it.each(weekDaysEnums)("accepts the week day %s", (day) => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, weekDays: [day] })
        .success,
    ).toBe(true);
  });

  it("rejects an invalid week day", () => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, weekDays: ["Funday"] })
        .success,
    ).toBe(false);
  });

  it("accepts an empty weekDays array (rule enforced post-parse)", () => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, weekDays: [] }).success,
    ).toBe(true);
  });

  it("rejects a non-array weekDays", () => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, weekDays: "Monday" })
        .success,
    ).toBe(false);
  });

  it.each([
    { fixedPrice: 9.99 },
    { discountPercent: 20 },
    { twoForOne: true },
    { threeForTwo: true },
    { secondHalfPrice: true },
    { fullComplimentary: true },
  ])("accepts the promotion type %j", (promotionType) => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, promotionType }).success,
    ).toBe(true);
  });

  it("accepts an empty promotion type (exactly-one rule enforced post-parse)", () => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, promotionType: {} })
        .success,
    ).toBe(true);
  });

  it("accepts a promotion type with more than one pricing key (rule enforced post-parse)", () => {
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        promotionType: { fixedPrice: 9.99, discountPercent: 10 },
      }).success,
    ).toBe(true);
  });

  it("rejects a promotion type with the wrong value type", () => {
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        promotionType: { fixedPrice: "ten" },
      }).success,
    ).toBe(false);
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        promotionType: { twoForOne: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejects a promotion type with an unknown key", () => {
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        promotionType: { invalidKey: 10 },
      }).success,
    ).toBe(false);
  });

  it("accepts an array of businessGoodsToApplyIds and rejects malformed ones", () => {
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        businessGoodsToApplyIds: [VALID_ID],
      }).success,
    ).toBe(true);
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        businessGoodsToApplyIds: ["invalid-id"],
      }).success,
    ).toBe(false);
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        businessGoodsToApplyIds: "not-an-array",
      }).success,
    ).toBe(false);
  });

  it("coerces applyToDelivery and activePromotion from string forms", () => {
    const parsed = createPromotionBodySchema.parse({
      ...valid,
      activePromotion: "false",
      applyToDelivery: "yes",
    });
    expect(parsed.activePromotion).toBe(false);
    expect(parsed.applyToDelivery).toBe(true);
  });

  it("rejects a non-boolean activePromotion", () => {
    expect(
      createPromotionBodySchema.safeParse({
        ...valid,
        activePromotion: "maybe",
      }).success,
    ).toBe(false);
  });

  it("accepts an optional description", () => {
    const parsed = createPromotionBodySchema.parse({
      ...valid,
      description: "  <i>50%</i>  off  ",
    });
    expect(parsed.description).toBe("50% off");
  });

  it("rejects unknown keys", () => {
    expect(
      createPromotionBodySchema.safeParse({ ...valid, isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("promotionIdParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(
      promotionIdParamsSchema.safeParse({ promotionId: VALID_ID }).success,
    ).toBe(true);
  });

  it.each([{}, { promotionId: "invalid-id" }])("rejects %j", (params) => {
    expect(promotionIdParamsSchema.safeParse(params).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      promotionIdParamsSchema.safeParse({ promotionId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);
  });
});

describe("updatePromotionBodySchema", () => {
  it("accepts an empty update", () => {
    expect(updatePromotionBodySchema.safeParse({}).success).toBe(true);
  });

  it("sanitizes an updated promotionName", () => {
    const parsed = updatePromotionBodySchema.parse({
      promotionName: "  <i>Brunch</i>   Special ",
    });
    expect(parsed.promotionName).toBe("Brunch Special");
  });

  it("coerces an updated promotion period (start < end enforced post-parse)", () => {
    const parsed = updatePromotionBodySchema.parse({
      promotionPeriod: { start: "2024-02-01", end: "2024-03-01" },
    });
    expect(parsed.promotionPeriod?.start).toBeInstanceOf(Date);
    expect(
      updatePromotionBodySchema.safeParse({
        promotionPeriod: { start: "2024-03-01", end: "2024-02-01" },
      }).success,
    ).toBe(true);
  });

  it("accepts an updated promotion type and rejects a malformed one", () => {
    expect(
      updatePromotionBodySchema.safeParse({
        promotionType: { discountPercent: 15 },
      }).success,
    ).toBe(true);
    expect(
      updatePromotionBodySchema.safeParse({
        promotionType: { discountPercent: "15" },
      }).success,
    ).toBe(false);
  });

  it("rejects a businessId (not client-settable on update)", () => {
    expect(
      updatePromotionBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updatePromotionBodySchema.safeParse({ isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("promotionsByBusinessParamsSchema", () => {
  it("accepts a valid businessId and rejects a malformed one", () => {
    expect(
      promotionsByBusinessParamsSchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      promotionsByBusinessParamsSchema.safeParse({ businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });
});

describe("promotionsByBusinessQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(promotionsByBusinessQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces the start and end dates", () => {
    const parsed = promotionsByBusinessQuerySchema.parse({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(parsed.startDate).toBeInstanceOf(Date);
    expect(parsed.endDate).toBeInstanceOf(Date);
  });

  it("treats an empty date string as not provided", () => {
    const parsed = promotionsByBusinessQuerySchema.parse({
      startDate: "",
      endDate: "",
    });
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.endDate).toBeUndefined();
  });

  it("rejects a malformed date", () => {
    expect(
      promotionsByBusinessQuerySchema.safeParse({ startDate: "not-a-date" })
        .success,
    ).toBe(false);
  });

  it("accepts an inverted date range (rule enforced in the route)", () => {
    expect(
      promotionsByBusinessQuerySchema.safeParse({
        startDate: "2024-12-31",
        endDate: "2024-01-01",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(
      promotionsByBusinessQuerySchema.safeParse({ limit: 10 }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every promotions DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createPromotionBodySchema,
    promotionIdParamsSchema,
    updatePromotionBodySchema,
    promotionsByBusinessParamsSchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("_id");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
    },
  );
});
