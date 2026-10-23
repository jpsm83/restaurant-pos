import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  addInventoryCountBodySchema,
  businessIdParamsSchema,
  createInventoryBodySchema,
  inventoryIdParamsSchema,
  inventoryIncludeDeletedQuerySchema,
  inventoryMonthDateQuerySchema,
  inventoriesByBusinessQuerySchema,
  inventorySupplierGoodParamsSchema,
  updateInventoryCountBodySchema,
  varianceReportQuerySchema,
} from "../../src/schemas/inventories.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

describe("createInventoryBodySchema", () => {
  it("accepts a businessId", () => {
    expect(
      createInventoryBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
  });

  it("trims an ObjectId", () => {
    const parsed = createInventoryBodySchema.parse({
      businessId: `  ${VALID_ID}  `,
    });
    expect(parsed.businessId).toBe(VALID_ID);
  });

  it("requires a valid businessId", () => {
    expect(createInventoryBodySchema.safeParse({}).success).toBe(false);
    expect(
      createInventoryBodySchema.safeParse({ businessId: "invalid-id" }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createInventoryBodySchema.safeParse({
        businessId: VALID_ID,
        setFinalCount: true,
      }).success,
    ).toBe(false);
  });
});

describe("inventory param schemas", () => {
  it("accepts valid ObjectIds and rejects junk, unknown keys and empties", () => {
    expect(inventoryIdParamsSchema.safeParse({ inventoryId: VALID_ID }).success).toBe(
      true,
    );
    expect(
      inventoryIdParamsSchema.safeParse({ inventoryId: "invalid-id" }).success,
    ).toBe(false);
    expect(
      inventoryIdParamsSchema.safeParse({ inventoryId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);
    expect(inventoryIdParamsSchema.safeParse({}).success).toBe(false);
  });

  it("requires both inventoryId and supplierGoodId", () => {
    expect(
      inventorySupplierGoodParamsSchema.safeParse({
        inventoryId: VALID_ID,
        supplierGoodId: OTHER_ID,
      }).success,
    ).toBe(true);
    expect(
      inventorySupplierGoodParamsSchema.safeParse({ inventoryId: VALID_ID })
        .success,
    ).toBe(false);
    expect(
      inventorySupplierGoodParamsSchema.safeParse({
        inventoryId: VALID_ID,
        supplierGoodId: "nope",
      }).success,
    ).toBe(false);
  });

  it("accepts a businessId and rejects junk", () => {
    expect(businessIdParamsSchema.safeParse({ businessId: VALID_ID }).success).toBe(
      true,
    );
    expect(
      businessIdParamsSchema.safeParse({ businessId: "nope" }).success,
    ).toBe(false);
  });
});

describe("inventoryMonthDateQuerySchema", () => {
  it("coerces a date string to a Date", () => {
    const parsed = inventoryMonthDateQuerySchema.parse({
      monthDate: "2024-06-15",
    });
    expect(parsed.monthDate).toBeInstanceOf(Date);
    expect(parsed.monthDate?.getUTCFullYear()).toBe(2024);
  });

  it("treats an empty string and an absent value as undefined", () => {
    expect(
      inventoryMonthDateQuerySchema.parse({ monthDate: "" }).monthDate,
    ).toBeUndefined();
    expect(inventoryMonthDateQuerySchema.parse({}).monthDate).toBeUndefined();
  });

  it("rejects an unparseable date and unknown keys", () => {
    expect(
      inventoryMonthDateQuerySchema.safeParse({ monthDate: "not-a-date" })
        .success,
    ).toBe(false);
    expect(
      inventoryMonthDateQuerySchema.safeParse({ monthDate: "2024-06-15", x: "1" })
        .success,
    ).toBe(false);
  });
});

describe("inventoryIncludeDeletedQuerySchema", () => {
  it("accepts an omitted includeDeleted", () => {
    expect(
      inventoryIncludeDeletedQuerySchema.parse({}).includeDeleted,
    ).toBeUndefined();
  });

  it("treats a blank includeDeleted as omitted", () => {
    expect(
      inventoryIncludeDeletedQuerySchema.parse({ includeDeleted: "" })
        .includeDeleted,
    ).toBeUndefined();
  });

  it("coerces string booleans", () => {
    expect(
      inventoryIncludeDeletedQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
    expect(
      inventoryIncludeDeletedQuerySchema.parse({ includeDeleted: "false" })
        .includeDeleted,
    ).toBe(false);
  });

  it("rejects a non-boolean includeDeleted and unknown keys", () => {
    expect(
      inventoryIncludeDeletedQuerySchema.safeParse({ includeDeleted: "maybe" })
        .success,
    ).toBe(false);
    expect(
      inventoryIncludeDeletedQuerySchema.safeParse({
        includeDeleted: true,
        setFinalCount: true,
      }).success,
    ).toBe(false);
  });
});

describe("inventoriesByBusinessQuerySchema", () => {
  it("accepts an empty query", () => {
    const parsed = inventoriesByBusinessQuerySchema.parse({});
    expect(parsed.monthDate).toBeUndefined();
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("treats blank monthDate and includeDeleted as omitted", () => {
    const parsed = inventoriesByBusinessQuerySchema.parse({
      monthDate: "",
      includeDeleted: "",
    });
    expect(parsed.monthDate).toBeUndefined();
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("coerces a monthDate and a string boolean together", () => {
    const parsed = inventoriesByBusinessQuerySchema.parse({
      monthDate: "2024-06-15",
      includeDeleted: "true",
    });
    expect(parsed.monthDate).toBeInstanceOf(Date);
    expect(parsed.monthDate?.getUTCFullYear()).toBe(2024);
    expect(parsed.includeDeleted).toBe(true);
  });

  it("rejects a non-boolean includeDeleted, an unparseable monthDate, and unknown keys", () => {
    expect(
      inventoriesByBusinessQuerySchema.safeParse({ includeDeleted: "maybe" })
        .success,
    ).toBe(false);
    expect(
      inventoriesByBusinessQuerySchema.safeParse({ monthDate: "not-a-date" })
        .success,
    ).toBe(false);
    expect(
      inventoriesByBusinessQuerySchema.safeParse({
        includeDeleted: false,
        setFinalCount: true,
      }).success,
    ).toBe(false);
  });
});

describe("addInventoryCountBodySchema", () => {
  const valid = {
    currentCountQuantity: 40,
    countedByEmployeeId: VALID_ID,
  };

  it("accepts the minimum required fields", () => {
    expect(addInventoryCountBodySchema.safeParse(valid).success).toBe(true);
  });

  it("requires currentCountQuantity and countedByEmployeeId", () => {
    for (const key of [
      "currentCountQuantity",
      "countedByEmployeeId",
    ] as const) {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[key];
      expect(
        addInventoryCountBodySchema.safeParse(payload).success,
        `missing ${key} should fail`,
      ).toBe(false);
    }
  });

  it("coerces a numeric-string quantity", () => {
    const parsed = addInventoryCountBodySchema.parse({
      ...valid,
      currentCountQuantity: "40",
    });
    expect(parsed.currentCountQuantity).toBe(40);
  });

  it("accepts zero as a valid quantity", () => {
    expect(
      addInventoryCountBodySchema.safeParse({
        ...valid,
        currentCountQuantity: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-numeric quantity", () => {
    expect(
      addInventoryCountBodySchema.safeParse({
        ...valid,
        currentCountQuantity: "abc",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed employee id", () => {
    expect(
      addInventoryCountBodySchema.safeParse({
        ...valid,
        countedByEmployeeId: "nope",
      }).success,
    ).toBe(false);
  });

  it("sanitizes comments as free text", () => {
    const parsed = addInventoryCountBodySchema.parse({
      ...valid,
      comments: "  <b>short</b> by two\n\n\nunits  ",
    });
    expect(parsed.comments).toBe("short by two\n\nunits");
  });

  it("rejects the server-computed quantityNeeded and deviationPercent", () => {
    expect(
      addInventoryCountBodySchema.safeParse({ ...valid, quantityNeeded: 10 })
        .success,
    ).toBe(false);
    expect(
      addInventoryCountBodySchema.safeParse({ ...valid, deviationPercent: 5 })
        .success,
    ).toBe(false);
  });
});

describe("updateInventoryCountBodySchema", () => {
  const valid = {
    countId: VALID_ID,
    reason: "mistyped quantity",
  };

  it("accepts the minimum required fields", () => {
    expect(updateInventoryCountBodySchema.safeParse(valid).success).toBe(true);
  });

  it("requires countId and reason", () => {
    for (const key of ["countId", "reason"] as const) {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[key];
      expect(
        updateInventoryCountBodySchema.safeParse(payload).success,
        `missing ${key} should fail`,
      ).toBe(false);
    }
  });

  it("accepts optional currentCountQuantity and comments", () => {
    const parsed = updateInventoryCountBodySchema.parse({
      ...valid,
      currentCountQuantity: "15",
      comments: "recounted",
    });
    expect(parsed.currentCountQuantity).toBe(15);
    expect(parsed.comments).toBe("recounted");
  });

  it("rejects a malformed countId and unknown keys", () => {
    expect(
      updateInventoryCountBodySchema.safeParse({ ...valid, countId: "nope" })
        .success,
    ).toBe(false);
    expect(
      updateInventoryCountBodySchema.safeParse({ ...valid, reedited: {} })
        .success,
    ).toBe(false);
  });
});

describe("varianceReportQuerySchema", () => {
  it("parses a YYYY-MM month into numeric year and month", () => {
    expect(varianceReportQuerySchema.parse({ month: "2024-06" })).toEqual({
      month: { year: 2024, month: 6 },
    });
  });

  it("treats an empty or absent month as undefined", () => {
    expect(varianceReportQuerySchema.parse({ month: "" }).month).toBeUndefined();
    expect(varianceReportQuerySchema.parse({}).month).toBeUndefined();
  });

  it("rejects a month outside 01-12", () => {
    expect(varianceReportQuerySchema.safeParse({ month: "2024-13" }).success).toBe(
      false,
    );
    expect(varianceReportQuerySchema.safeParse({ month: "2024-00" }).success).toBe(
      false,
    );
  });

  it("rejects a malformed month and unknown keys", () => {
    expect(
      varianceReportQuerySchema.safeParse({ month: "2024-6" }).success,
    ).toBe(false);
    expect(
      varianceReportQuerySchema.safeParse({ month: "invalid" }).success,
    ).toBe(false);
    expect(
      varianceReportQuerySchema.safeParse({ month: "2024-06", x: "1" }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every inventories DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createInventoryBodySchema,
    inventoryIdParamsSchema,
    inventorySupplierGoodParamsSchema,
    businessIdParamsSchema,
    inventoryMonthDateQuerySchema,
    inventoryIncludeDeletedQuerySchema,
    inventoriesByBusinessQuerySchema,
    addInventoryCountBodySchema,
    updateInventoryCountBodySchema,
    varianceReportQuerySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("_id");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
      expect(keys).not.toContain("setFinalCount");
      expect(keys).not.toContain("inventoryGoods");
      expect(keys).not.toContain("quantityNeeded");
      expect(keys).not.toContain("deviationPercent");
    },
  );
});
