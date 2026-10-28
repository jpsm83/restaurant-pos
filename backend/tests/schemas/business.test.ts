import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  businessAddressSchema,
  businessIdParamsSchema,
  businessMetricsSchema,
  businessReportingConfigSchema,
  discoverBusinessesQuerySchema,
  updateBusinessBodySchema,
} from "restaurant-pos-packages/schemas/business";

const VALID_ID = "507f1f77bcf86cd799439011";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

describe("businessAddressSchema", () => {
  it("requires the six location fields", () => {
    expect(businessAddressSchema.safeParse(validAddress).success).toBe(true);

    for (const key of Object.keys(validAddress)) {
      const copy: Record<string, unknown> = { ...validAddress };
      delete copy[key];
      expect(
        businessAddressSchema.safeParse(copy).success,
        `missing ${key}`,
      ).toBe(false);
    }
  });

  it("accepts and sanitizes the optional fields", () => {
    const parsed = businessAddressSchema.parse({
      ...validAddress,
      region: "  <b>West</b>  ",
      coordinates: [40.71, -74.0],
    });
    expect(parsed.region).toBe("West");
    expect(parsed.coordinates).toEqual([40.71, -74.0]);
  });

  it("rejects unknown keys", () => {
    expect(
      businessAddressSchema.safeParse({ ...validAddress, extra: "x" }).success,
    ).toBe(false);
  });
});

describe("updateBusinessBodySchema", () => {
  const validUpdate = {
    tradeName: "Cafe Demo",
    legalName: "Cafe Demo LLC",
    phoneNumber: "1234567890",
    taxNumber: "TAX-001",
    subscription: "Free",
    currencyTrade: "USD",
    address: JSON.stringify(validAddress),
  };

  it("requires the identity fields", () => {
    expect(updateBusinessBodySchema.safeParse(validUpdate).success).toBe(true);

    const { legalName: _drop, ...withoutLegalName } = validUpdate;
    expect(updateBusinessBodySchema.safeParse(withoutLegalName).success).toBe(
      false,
    );
  });

  it("treats every other field as optional", () => {
    const parsed = updateBusinessBodySchema.parse(validUpdate);
    expect(parsed.metrics).toBeUndefined();
    expect(parsed.reportingConfig).toBeUndefined();
  });

  it.each([
    ["the sign-in email", { email: "owner@example.com" }],
    ["the email confirmation", { confirmEmail: "owner@example.com" }],
    ["a new password", { password: "Password1!" }],
    ["the current password", { currentPassword: "Password1!" }],
  ])("rejects %s as an unknown key", (_label, override) => {
    expect(
      updateBusinessBodySchema.safeParse({ ...validUpdate, ...override })
        .success,
    ).toBe(false);
  });

  it("validates the JSON-encoded metrics and nested waste percentages", () => {
    const metrics = {
      foodCostPercentage: 30,
      beverageCostPercentage: 20,
      laborCostPercentage: 30,
      fixedCostPercentage: 20,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: 9,
        lowBudgetImpact: 7,
        mediumBudgetImpact: 5,
        hightBudgetImpact: 3,
        veryHightBudgetImpact: 1,
      },
    };
    const parsed = updateBusinessBodySchema.parse({
      ...validUpdate,
      metrics: JSON.stringify(metrics),
    });
    expect(parsed.metrics).toEqual(metrics);

    expect(businessMetricsSchema.safeParse(metrics).success).toBe(true);
    const { mediumBudgetImpact: _drop, ...withoutKey } =
      metrics.supplierGoodWastePercentage;
    expect(
      businessMetricsSchema.safeParse({
        ...metrics,
        supplierGoodWastePercentage: withoutKey,
      }).success,
    ).toBe(false);
  });

  it("validates the JSON-encoded reporting config", () => {
    const parsed = updateBusinessBodySchema.parse({
      ...validUpdate,
      reportingConfig: JSON.stringify({ weeklyReportStartDay: 3 }),
    });
    expect(parsed.reportingConfig).toEqual({ weeklyReportStartDay: 3 });

    expect(
      businessReportingConfigSchema.safeParse({ weeklyReportStartDay: 7 })
        .success,
    ).toBe(false);
    expect(
      businessReportingConfigSchema.safeParse({ weeklyReportStartDay: 1.5 })
        .success,
    ).toBe(false);
  });

  it("clears the cuisine list on a blank field, leaves it absent otherwise", () => {
    expect(
      updateBusinessBodySchema.parse({ ...validUpdate, cuisineType: "" })
        .cuisineType,
    ).toEqual([]);
    expect(
      updateBusinessBodySchema.parse(validUpdate).cuisineType,
    ).toBeUndefined();
  });

  it("rejects server-owned fields", () => {
    expect(
      updateBusinessBodySchema.safeParse({
        ...validUpdate,
        averageRating: 5,
      }).success,
    ).toBe(false);
  });
});

describe("businessIdParamsSchema", () => {
  it("accepts a valid ObjectId and rejects a malformed one", () => {
    expect(businessIdParamsSchema.safeParse({ businessId: VALID_ID }).success).toBe(
      true,
    );
    expect(
      businessIdParamsSchema.safeParse({ businessId: "invalid-id" }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      businessIdParamsSchema.safeParse({ businessId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);
  });
});

describe("discoverBusinessesQuerySchema", () => {
  it("coerces numeric and boolean-like query values", () => {
    const parsed = discoverBusinessesQuerySchema.parse({
      cuisineType: "Italian",
      rating: "4.5",
      lat: "1.5",
      lng: "-2.5",
      radius: "10",
      limit: "25",
    });
    expect(parsed).toMatchObject({
      cuisineType: "Italian",
      rating: 4.5,
      lat: 1.5,
      lng: -2.5,
      radius: 10,
      limit: 25,
    });
  });

  it("treats blank values as not provided", () => {
    const parsed = discoverBusinessesQuerySchema.parse({
      name: "  ",
      rating: "",
      limit: "",
    });
    expect(parsed.name).toBeUndefined();
    expect(parsed.rating).toBeUndefined();
    expect(parsed.limit).toBeUndefined();
  });

  it("clamps the limit to safe bounds", () => {
    expect(discoverBusinessesQuerySchema.parse({ limit: "500" }).limit).toBe(100);
    expect(discoverBusinessesQuerySchema.parse({ limit: "-3" }).limit).toBe(1);
    expect(discoverBusinessesQuerySchema.parse({}).limit).toBeUndefined();
  });

  it("rejects an out-of-range rating", () => {
    expect(
      discoverBusinessesQuerySchema.safeParse({ rating: "6" }).success,
    ).toBe(false);
  });

  it("rejects an unknown cuisine and unknown keys", () => {
    expect(
      discoverBusinessesQuerySchema.safeParse({ cuisineType: "Martian" }).success,
    ).toBe(false);
    expect(
      discoverBusinessesQuerySchema.safeParse({ sort: "asc" }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every business DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
      updateBusinessBodySchema,
    businessIdParamsSchema,
    discoverBusinessesQuerySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("averageRating");
      expect(keys).not.toContain("ratingCount");
      expect(keys).not.toContain("timezone");
      expect(keys).not.toContain("emailVerified");
      expect(keys).not.toContain("refreshSessionVersion");
      expect(keys).not.toContain("verificationToken");
      expect(keys).not.toContain("resetPasswordToken");
    },
  );
});
