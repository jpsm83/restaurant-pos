import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  ONE_TIME_PURCHASE_SUPPLIER,
  addPurchaseItemBodySchema,
  createPurchaseBodySchema,
  deletePurchaseItemBodySchema,
  editPurchaseItemBodySchema,
  purchaseBySupplierParamsSchema,
  purchaseByUserParamsSchema,
  purchaseIdParamsSchema,
  purchasesQuerySchema,
  updatePurchaseBodySchema,
} from "../../../packages/schemas/purchase.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

const validCreate = {
  supplierId: VALID_ID,
  purchaseDate: "2024-06-15T00:00:00.000Z",
  businessId: VALID_ID,
  purchasedByEmployeeId: OTHER_ID,
  receiptId: "REC-001",
  purchaseInventoryItems: [
    { supplierGoodId: OTHER_ID, quantityPurchased: 10, purchasePrice: 25.5 },
  ],
};

describe("createPurchaseBodySchema", () => {
  it("accepts a valid JSON payload and coerces the date", () => {
    const parsed = createPurchaseBodySchema.parse(validCreate);
    expect(parsed.purchaseDate).toBeInstanceOf(Date);
    expect(parsed.supplierId).toBe(VALID_ID);
  });

  it("accepts the one-time-purchase supplier sentinel", () => {
    const parsed = createPurchaseBodySchema.parse({
      ...validCreate,
      supplierId: ONE_TIME_PURCHASE_SUPPLIER,
      comment: "ad-hoc purchase",
    });
    expect(parsed.supplierId).toBe(ONE_TIME_PURCHASE_SUPPLIER);
  });

  it("rejects an unknown supplierId", () => {
    expect(
      createPurchaseBodySchema.safeParse({ ...validCreate, supplierId: "nope" })
        .success,
    ).toBe(false);
  });

  it("requires the core fields", () => {
    for (const key of [
      "supplierId",
      "purchaseDate",
      "businessId",
      "purchasedByEmployeeId",
      "receiptId",
      "purchaseInventoryItems",
    ] as const) {
      const payload: Record<string, unknown> = { ...validCreate };
      delete payload[key];
      expect(
        createPurchaseBodySchema.safeParse(payload).success,
        `missing ${key} should fail`,
      ).toBe(false);
    }
  });

  it("coerces numeric-string line quantities and prices", () => {
    const parsed = createPurchaseBodySchema.parse({
      ...validCreate,
      purchaseInventoryItems: [
        { supplierGoodId: OTHER_ID, quantityPurchased: "5", purchasePrice: "12.5" },
      ],
    });
    expect(parsed.purchaseInventoryItems[0].quantityPurchased).toBe(5);
    expect(parsed.purchaseInventoryItems[0].purchasePrice).toBe(12.5);
  });

  it("rejects a non-numeric line quantity", () => {
    expect(
      createPurchaseBodySchema.safeParse({
        ...validCreate,
        purchaseInventoryItems: [{ quantityPurchased: "abc", purchasePrice: 1 }],
      }).success,
    ).toBe(false);
  });

  it("allows a line without a supplierGoodId (one-time purchase)", () => {
    expect(
      createPurchaseBodySchema.safeParse({
        ...validCreate,
        purchaseInventoryItems: [{ quantityPurchased: 1, purchasePrice: 1 }],
      }).success,
    ).toBe(true);
  });

  it("sanitizes title and comment and treats blanks as absent", () => {
    const parsed = createPurchaseBodySchema.parse({
      ...validCreate,
      title: "  <b>Weekly</b>   order ",
      comment: "  <i>note</i>  ",
    });
    expect(parsed.title).toBe("Weekly order");
    expect(parsed.comment).toBe("note");

    const blank = createPurchaseBodySchema.parse({
      ...validCreate,
      title: "   ",
      comment: "",
    });
    expect(blank.title).toBeUndefined();
    expect(blank.comment).toBeUndefined();
  });

  it("rejects unknown and server-owned fields", () => {
    for (const field of [
      "totalAmount",
      "oneTimePurchase",
      "documentsUrl",
      "_id",
      "createdAt",
    ]) {
      expect(
        createPurchaseBodySchema.safeParse({ ...validCreate, [field]: "x" })
          .success,
        `${field} should be rejected`,
      ).toBe(false);
    }
  });
});

describe("updatePurchaseBodySchema", () => {
  const valid = {
    businessId: VALID_ID,
    purchasedByEmployeeId: OTHER_ID,
  };

  it("accepts the minimum required fields", () => {
    expect(updatePurchaseBodySchema.safeParse(valid).success).toBe(true);
  });

  it("requires businessId and purchasedByEmployeeId", () => {
    for (const key of ["businessId", "purchasedByEmployeeId"] as const) {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[key];
      expect(
        updatePurchaseBodySchema.safeParse(payload).success,
        `missing ${key} should fail`,
      ).toBe(false);
    }
  });

  it("coerces a multipart purchaseDate string and sanitizes title", () => {
    const parsed = updatePurchaseBodySchema.parse({
      ...valid,
      purchaseDate: "2024-06-15T12:00:00.000Z",
      title: "  <b>Updated</b>  title ",
      receiptId: "REC-002",
    });
    expect(parsed.purchaseDate).toBeInstanceOf(Date);
    expect(parsed.title).toBe("Updated title");
    expect(parsed.receiptId).toBe("REC-002");
  });

  it("treats blank optional fields as absent", () => {
    const parsed = updatePurchaseBodySchema.parse({
      ...valid,
      title: "",
      purchaseDate: "",
      receiptId: "   ",
    });
    expect(parsed.title).toBeUndefined();
    expect(parsed.purchaseDate).toBeUndefined();
    expect(parsed.receiptId).toBeUndefined();
  });

  it("rejects unknown fields", () => {
    expect(
      updatePurchaseBodySchema.safeParse({ ...valid, documentsUrl: [] }).success,
    ).toBe(false);
  });
});

describe("purchase param schemas", () => {
  it("accepts valid ObjectIds and rejects junk and unknown keys", () => {
    expect(purchaseIdParamsSchema.safeParse({ purchaseId: VALID_ID }).success).toBe(
      true,
    );
    expect(
      purchaseIdParamsSchema.safeParse({ purchaseId: "invalid" }).success,
    ).toBe(false);
    expect(
      purchaseIdParamsSchema.safeParse({ purchaseId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);

    expect(
      purchaseBySupplierParamsSchema.safeParse({ supplierId: VALID_ID }).success,
    ).toBe(true);
    expect(
      purchaseBySupplierParamsSchema.safeParse({ supplierId: "invalid" }).success,
    ).toBe(false);

    expect(
      purchaseByUserParamsSchema.safeParse({ userId: VALID_ID }).success,
    ).toBe(true);
    expect(
      purchaseByUserParamsSchema.safeParse({ userId: "invalid" }).success,
    ).toBe(false);
  });
});

describe("purchasesQuerySchema", () => {
  it("accepts plain calendar dates", () => {
    expect(
      purchasesQuerySchema.parse({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      }),
    ).toEqual({ startDate: "2024-01-01", endDate: "2024-12-31" });
  });

  it("treats empty and absent values as undefined", () => {
    expect(
      purchasesQuerySchema.parse({ startDate: "", endDate: "" }),
    ).toEqual({ startDate: undefined, endDate: undefined });
    expect(purchasesQuerySchema.parse({})).toEqual({
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("rejects date-times, malformed dates and unknown keys", () => {
    expect(
      purchasesQuerySchema.safeParse({ startDate: "2024-01-01T10:00:00Z" })
        .success,
    ).toBe(false);
    expect(
      purchasesQuerySchema.safeParse({ startDate: "not-a-date" }).success,
    ).toBe(false);
    expect(
      purchasesQuerySchema.safeParse({ startDate: "2024-01-01", x: "1" }).success,
    ).toBe(false);
  });
});

describe("purchase item body schemas", () => {
  it("validates the addSupplierGood body", () => {
    const parsed = addPurchaseItemBodySchema.parse({
      supplierGoodId: VALID_ID,
      quantityPurchased: "20",
      purchasePrice: "200",
    });
    expect(parsed.quantityPurchased).toBe(20);
    expect(parsed.purchasePrice).toBe(200);
    expect(
      addPurchaseItemBodySchema.safeParse({
        supplierGoodId: "nope",
        quantityPurchased: 1,
        purchasePrice: 1,
      }).success,
    ).toBe(false);
    expect(
      addPurchaseItemBodySchema.safeParse({
        supplierGoodId: VALID_ID,
        quantityPurchased: 1,
        purchasePrice: 1,
        extra: "x",
      }).success,
    ).toBe(false);
  });

  it("validates the deleteSupplierGood body", () => {
    expect(
      deletePurchaseItemBodySchema.safeParse({
        purchaseInventoryItemsId: VALID_ID,
      }).success,
    ).toBe(true);
    expect(
      deletePurchaseItemBodySchema.safeParse({
        purchaseInventoryItemsId: "nope",
      }).success,
    ).toBe(false);
  });

  it("requires a reason on the editSupplierGood body", () => {
    expect(
      editPurchaseItemBodySchema.safeParse({
        purchaseInventoryItemsId: VALID_ID,
        reason: "correction",
      }).success,
    ).toBe(true);
    expect(
      editPurchaseItemBodySchema.safeParse({
        purchaseInventoryItemsId: VALID_ID,
      }).success,
    ).toBe(false);
    expect(
      editPurchaseItemBodySchema.safeParse({
        purchaseInventoryItemsId: VALID_ID,
        reason: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every purchase DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createPurchaseBodySchema,
    updatePurchaseBodySchema,
    purchaseIdParamsSchema,
    purchaseBySupplierParamsSchema,
    purchaseByUserParamsSchema,
    purchasesQuerySchema,
    addPurchaseItemBodySchema,
    deletePurchaseItemBodySchema,
    editPurchaseItemBodySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("_id");
      expect(keys).not.toContain("totalAmount");
      expect(keys).not.toContain("oneTimePurchase");
      expect(keys).not.toContain("documentsUrl");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
    },
  );
});
