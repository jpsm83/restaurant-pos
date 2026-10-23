import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  createSalesPointBodySchema,
  salesPointIdParamsSchema,
  salesPointsIncludeDeletedQuerySchema,
  updateSalesPointBodySchema,
} from "restaurant-pos-packages/schemas/salesPoints";
import { salesPointTypeEnums } from "restaurant-pos-packages/enums";

const VALID_ID = "507f1f77bcf86cd799439011";

const valid = { salesPointName: "Table 1", businessId: VALID_ID };

describe("createSalesPointBodySchema", () => {
  it("accepts the minimum required fields", () => {
    expect(createSalesPointBodySchema.safeParse(valid).success).toBe(true);
  });

  it("sanitizes the salesPointName (HTML stripped, whitespace collapsed)", () => {
    const parsed = createSalesPointBodySchema.parse({
      ...valid,
      salesPointName: "  <b>Table</b>   1  ",
    });
    expect(parsed.salesPointName).toBe("Table 1");
  });

  it("requires salesPointName and businessId", () => {
    expect(createSalesPointBodySchema.safeParse({}).success).toBe(false);
    expect(
      createSalesPointBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
    expect(
      createSalesPointBodySchema.safeParse({ salesPointName: "Table 1" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty salesPointName", () => {
    expect(
      createSalesPointBodySchema.safeParse({ ...valid, salesPointName: "   " })
        .success,
    ).toBe(false);
  });

  it("trims a businessId", () => {
    const parsed = createSalesPointBodySchema.parse({
      ...valid,
      businessId: `  ${VALID_ID}  `,
    });
    expect(parsed.businessId).toBe(VALID_ID);
  });

  it("rejects a malformed businessId", () => {
    expect(
      createSalesPointBodySchema.safeParse({ ...valid, businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it.each(salesPointTypeEnums)("accepts the salesPointType %s", (type) => {
    expect(
      createSalesPointBodySchema.safeParse({ ...valid, salesPointType: type })
        .success,
    ).toBe(true);
  });

  it("normalizes the salesPointType to lower case", () => {
    const parsed = createSalesPointBodySchema.parse({
      ...valid,
      salesPointType: "  TaBlE  ",
    });
    expect(parsed.salesPointType).toBe("table");
  });

  it("rejects a salesPointType outside the shared enum", () => {
    expect(
      createSalesPointBodySchema.safeParse({
        ...valid,
        salesPointType: "InvalidType",
      }).success,
    ).toBe(false);
  });

  it("treats an empty salesPointType as not provided", () => {
    const parsed = createSalesPointBodySchema.parse({
      ...valid,
      salesPointType: "",
    });
    expect(parsed.salesPointType).toBeUndefined();
  });

  it("treats salesPointType as optional", () => {
    expect(createSalesPointBodySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a boolean selfOrdering and coerces string forms", () => {
    expect(
      createSalesPointBodySchema.parse({ ...valid, selfOrdering: false })
        .selfOrdering,
    ).toBe(false);
    expect(
      createSalesPointBodySchema.parse({ ...valid, selfOrdering: "true" })
        .selfOrdering,
    ).toBe(true);
    expect(
      createSalesPointBodySchema.parse({ ...valid, selfOrdering: "off" })
        .selfOrdering,
    ).toBe(false);
  });

  it("rejects a non-boolean selfOrdering", () => {
    expect(
      createSalesPointBodySchema.safeParse({ ...valid, selfOrdering: "maybe" })
        .success,
    ).toBe(false);
  });

  it("rejects the server-owned qrCode", () => {
    expect(
      createSalesPointBodySchema.safeParse({
        ...valid,
        qrCode: "https://example.com/qr.png",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createSalesPointBodySchema.safeParse({ ...valid, isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("salesPointIdParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(
      salesPointIdParamsSchema.safeParse({ salesPointId: VALID_ID }).success,
    ).toBe(true);
  });

  it.each([{}, { salesPointId: "invalid-id" }])("rejects %j", (params) => {
    expect(salesPointIdParamsSchema.safeParse(params).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      salesPointIdParamsSchema.safeParse({ salesPointId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);
  });
});

describe("updateSalesPointBodySchema", () => {
  it("accepts an empty update", () => {
    expect(updateSalesPointBodySchema.safeParse({}).success).toBe(true);
  });

  it("sanitizes an updated salesPointName", () => {
    const parsed = updateSalesPointBodySchema.parse({
      salesPointName: "  <i>Patio</i>  2 ",
    });
    expect(parsed.salesPointName).toBe("Patio 2");
  });

  it("normalizes an updated salesPointType", () => {
    const parsed = updateSalesPointBodySchema.parse({
      salesPointType: "DELIVERY",
    });
    expect(parsed.salesPointType).toBe("delivery");
  });

  it("rejects a salesPointType outside the shared enum", () => {
    expect(
      updateSalesPointBodySchema.safeParse({ salesPointType: "nope" }).success,
    ).toBe(false);
  });

  it("coerces an updated selfOrdering", () => {
    expect(
      updateSalesPointBodySchema.parse({ selfOrdering: "yes" }).selfOrdering,
    ).toBe(true);
  });

  it("rejects the server-owned qrCode", () => {
    expect(
      updateSalesPointBodySchema.safeParse({ qrCode: "x" }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updateSalesPointBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
  });
});

describe("salesPointsIncludeDeletedQuerySchema", () => {
  it("accepts an omitted includeDeleted", () => {
    const parsed = salesPointsIncludeDeletedQuerySchema.parse({});
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("coerces string booleans", () => {
    expect(
      salesPointsIncludeDeletedQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
    expect(
      salesPointsIncludeDeletedQuerySchema.parse({ includeDeleted: "false" })
        .includeDeleted,
    ).toBe(false);
  });

  it("rejects a non-boolean includeDeleted", () => {
    expect(
      salesPointsIncludeDeletedQuerySchema.safeParse({ includeDeleted: "maybe" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      salesPointsIncludeDeletedQuerySchema.safeParse({
        includeDeleted: true,
        qrCode: "x",
      }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every salesPoints DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createSalesPointBodySchema,
    salesPointIdParamsSchema,
    updateSalesPointBodySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("qrCode");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
    },
  );
});
