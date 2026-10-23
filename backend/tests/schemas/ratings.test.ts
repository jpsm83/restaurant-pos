import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  createRatingBodySchema,
  ratingIdParamsSchema,
  ratingsByBusinessParamsSchema,
  ratingsIncludeDeletedQuerySchema,
  ratingsPaginationQuerySchema,
  RATINGS_DEFAULT_LIMIT,
  RATINGS_MAX_LIMIT,
} from "restaurant-pos-packages/schemas/ratings";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

describe("createRatingBodySchema", () => {
  const valid = { businessId: VALID_ID, score: 4.5 };

  it("accepts the minimum required fields", () => {
    expect(createRatingBodySchema.safeParse(valid).success).toBe(true);
  });

  it("trims an ObjectId", () => {
    const parsed = createRatingBodySchema.parse({
      businessId: `  ${VALID_ID}  `,
      score: 4.5,
    });
    expect(parsed.businessId).toBe(VALID_ID);
  });

  it("requires businessId and score", () => {
    const noBusiness = createRatingBodySchema.safeParse({ score: 4.5 });
    const noScore = createRatingBodySchema.safeParse({ businessId: VALID_ID });
    expect(noBusiness.success).toBe(false);
    expect(noScore.success).toBe(false);
  });

  it("rejects a malformed businessId", () => {
    expect(
      createRatingBodySchema.safeParse({ ...valid, businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("accepts a score at each boundary", () => {
    expect(createRatingBodySchema.safeParse({ ...valid, score: 0 }).success).toBe(
      true,
    );
    expect(createRatingBodySchema.safeParse({ ...valid, score: 5 }).success).toBe(
      true,
    );
  });

  it.each([-0.5, 5.1, 10])("rejects an out-of-range score %s", (score) => {
    expect(createRatingBodySchema.safeParse({ ...valid, score }).success).toBe(
      false,
    );
  });

  it("rejects a non-number score", () => {
    expect(
      createRatingBodySchema.safeParse({ ...valid, score: "4.5" }).success,
    ).toBe(false);
  });

  it("treats orderId and comment as optional", () => {
    expect(createRatingBodySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a valid optional orderId", () => {
    const parsed = createRatingBodySchema.parse({
      ...valid,
      orderId: OTHER_ID,
      comment: "Nice",
    });
    expect(parsed.orderId).toBe(OTHER_ID);
  });

  it("rejects a malformed orderId", () => {
    expect(
      createRatingBodySchema.safeParse({ ...valid, orderId: "nope" }).success,
    ).toBe(false);
  });

  it("sanitizes the comment as free text (HTML stripped, newlines kept)", () => {
    const parsed = createRatingBodySchema.parse({
      ...valid,
      comment: "  <b>Great</b> food\n\n\nthanks  ",
    });
    expect(parsed.comment).toBe("Great food\n\nthanks");
  });

  it("rejects the server-owned userId", () => {
    expect(
      createRatingBodySchema.safeParse({ ...valid, userId: VALID_ID }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createRatingBodySchema.safeParse({ ...valid, isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("ratingIdParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(ratingIdParamsSchema.safeParse({ ratingId: VALID_ID }).success).toBe(
      true,
    );
  });

  it.each([{}, { ratingId: "invalid-id" }])(
    "rejects %j",
    (params) => {
      expect(ratingIdParamsSchema.safeParse(params).success).toBe(false);
    },
  );

  it("rejects unknown keys", () => {
    expect(
      ratingIdParamsSchema.safeParse({ ratingId: VALID_ID, extra: "x" }).success,
    ).toBe(false);
  });
});

describe("ratingsByBusinessParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(
      ratingsByBusinessParamsSchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
  });

  it("rejects a malformed businessId", () => {
    expect(
      ratingsByBusinessParamsSchema.safeParse({ businessId: "nope" }).success,
    ).toBe(false);
  });
});

describe("ratingsPaginationQuerySchema", () => {
  it("defaults limit and skip when absent", () => {
    expect(ratingsPaginationQuerySchema.parse({})).toEqual({
      limit: RATINGS_DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it("coerces numeric strings", () => {
    expect(ratingsPaginationQuerySchema.parse({ limit: "5", skip: "2" })).toEqual(
      { limit: 5, skip: 2 },
    );
  });

  it("clamps limit above the maximum", () => {
    expect(
      ratingsPaginationQuerySchema.parse({ limit: String(RATINGS_MAX_LIMIT * 5) })
        .limit,
    ).toBe(RATINGS_MAX_LIMIT);
  });

  it("clamps limit below the minimum to 1", () => {
    expect(ratingsPaginationQuerySchema.parse({ limit: 0 }).limit).toBe(1);
    expect(ratingsPaginationQuerySchema.parse({ limit: -3 }).limit).toBe(1);
  });

  it("clamps a negative skip to 0", () => {
    expect(ratingsPaginationQuerySchema.parse({ skip: -10 }).skip).toBe(0);
  });

  it("rejects a non-numeric limit", () => {
    expect(ratingsPaginationQuerySchema.safeParse({ limit: "abc" }).success).toBe(
      false,
    );
  });

  it("rejects unknown keys", () => {
    expect(
      ratingsPaginationQuerySchema.safeParse({ sort: "asc" }).success,
    ).toBe(false);
  });

  it("coerces includeDeleted and treats a blank value as omitted", () => {
    const withFlag = ratingsPaginationQuerySchema.parse({
      includeDeleted: "true",
    });
    expect(withFlag.includeDeleted).toBe(true);
    expect(withFlag.limit).toBe(RATINGS_DEFAULT_LIMIT);
    expect(
      ratingsPaginationQuerySchema.parse({ includeDeleted: "" }).includeDeleted,
    ).toBeUndefined();
  });

  it("rejects a non-boolean includeDeleted", () => {
    expect(
      ratingsPaginationQuerySchema.safeParse({ includeDeleted: "maybe" }).success,
    ).toBe(false);
  });
});

describe("ratingsIncludeDeletedQuerySchema", () => {
  it("accepts an omitted includeDeleted", () => {
    expect(
      ratingsIncludeDeletedQuerySchema.parse({}).includeDeleted,
    ).toBeUndefined();
  });

  it("treats a blank includeDeleted as omitted", () => {
    expect(
      ratingsIncludeDeletedQuerySchema.parse({ includeDeleted: "" })
        .includeDeleted,
    ).toBeUndefined();
  });

  it("coerces string booleans", () => {
    expect(
      ratingsIncludeDeletedQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
    expect(
      ratingsIncludeDeletedQuerySchema.parse({ includeDeleted: "false" })
        .includeDeleted,
    ).toBe(false);
  });

  it("rejects a non-boolean includeDeleted and unknown keys", () => {
    expect(
      ratingsIncludeDeletedQuerySchema.safeParse({ includeDeleted: "maybe" })
        .success,
    ).toBe(false);
    expect(
      ratingsIncludeDeletedQuerySchema.safeParse({
        includeDeleted: true,
        createdAt: "x",
      }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every ratings DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createRatingBodySchema,
    ratingIdParamsSchema,
    ratingsByBusinessParamsSchema,
    ratingsPaginationQuerySchema,
    ratingsIncludeDeletedQuerySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("userId");
      expect(keys).not.toContain("averageRating");
      expect(keys).not.toContain("ratingCount");
    },
  );
});
