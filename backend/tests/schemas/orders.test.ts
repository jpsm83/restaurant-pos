import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  createOrderBodySchema,
  orderIdParamsSchema,
  ordersBySalesInstanceParamsSchema,
  ordersByUserParamsSchema,
} from "../../../packages/schemas/orders.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

const validOrderItem = {
  businessGoodId: VALID_ID,
  orderGrossPrice: 12.99,
  orderNetPrice: 12.99,
  orderCostPrice: 4,
};

const validBody = {
  ordersArr: [validOrderItem],
  salesInstanceId: VALID_ID,
  businessId: OTHER_ID,
  dailyReferenceNumber: 20260324,
};

describe("createOrderBodySchema", () => {
  it("accepts a minimal order batch", () => {
    expect(createOrderBodySchema.safeParse(validBody).success).toBe(true);
  });

  it("coerces numeric-string prices and reference number", () => {
    const parsed = createOrderBodySchema.parse({
      ...validBody,
      dailyReferenceNumber: "20260324",
      ordersArr: [
        {
          businessGoodId: VALID_ID,
          orderGrossPrice: "12.99",
          orderNetPrice: "12.99",
          orderCostPrice: "4",
        },
      ],
    });
    expect(parsed.dailyReferenceNumber).toBe(20260324);
    expect(parsed.ordersArr[0].orderGrossPrice).toBe(12.99);
    expect(parsed.ordersArr[0].orderCostPrice).toBe(4);
  });

  it("requires ordersArr, salesInstanceId, businessId and dailyReferenceNumber", () => {
    expect(createOrderBodySchema.safeParse({}).success).toBe(false);
    expect(
      createOrderBodySchema.safeParse({ ...validBody, ordersArr: [] }).success,
    ).toBe(false);
    expect(
      createOrderBodySchema.safeParse({ ...validBody, salesInstanceId: undefined })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed salesInstanceId or businessId", () => {
    expect(
      createOrderBodySchema.safeParse({ ...validBody, salesInstanceId: "nope" })
        .success,
    ).toBe(false);
    expect(
      createOrderBodySchema.safeParse({ ...validBody, businessId: "nope" }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric dailyReferenceNumber", () => {
    expect(
      createOrderBodySchema.safeParse({ ...validBody, dailyReferenceNumber: "abc" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed businessGoodId inside an order", () => {
    expect(
      createOrderBodySchema.safeParse({
        ...validBody,
        ordersArr: [{ ...validOrderItem, businessGoodId: "nope" }],
      }).success,
    ).toBe(false);
  });

  it("accepts optional addOns, allergens, promotionApplyed and comments", () => {
    const parsed = createOrderBodySchema.parse({
      ...validBody,
      ordersArr: [
        {
          ...validOrderItem,
          addOns: [OTHER_ID],
          allergens: ["Gluten", "Milk"],
          promotionApplyed: "Lunch 2x1",
          comments: "No onions",
        },
      ],
    });
    expect(parsed.ordersArr[0].addOns).toEqual([OTHER_ID]);
    expect(parsed.ordersArr[0].allergens).toEqual(["Gluten", "Milk"]);
  });

  it("rejects an allergen outside the shared enum", () => {
    expect(
      createOrderBodySchema.safeParse({
        ...validBody,
        ordersArr: [{ ...validOrderItem, allergens: ["gluten"] }],
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed addOn id", () => {
    expect(
      createOrderBodySchema.safeParse({
        ...validBody,
        ordersArr: [{ ...validOrderItem, addOns: ["nope"] }],
      }).success,
    ).toBe(false);
  });

  it("sanitizes comments as free text (HTML stripped, newlines kept)", () => {
    const parsed = createOrderBodySchema.parse({
      ...validBody,
      ordersArr: [
        {
          ...validOrderItem,
          comments: "  <b>No</b> onions\n\n\nplease  ",
        },
      ],
    });
    expect(parsed.ordersArr[0].comments).toBe("No onions\n\nplease");
  });

  it("rejects unknown keys on the body", () => {
    expect(
      createOrderBodySchema.safeParse({ ...validBody, isAdmin: true }).success,
    ).toBe(false);
  });

  it("rejects server-owned keys inside an order", () => {
    expect(
      createOrderBodySchema.safeParse({
        ...validBody,
        ordersArr: [{ ...validOrderItem, createdByUserId: VALID_ID }],
      }).success,
    ).toBe(false);
    expect(
      createOrderBodySchema.safeParse({
        ...validBody,
        ordersArr: [{ ...validOrderItem, billingStatus: "Paid" }],
      }).success,
    ).toBe(false);
    expect(
      createOrderBodySchema.safeParse({
        ...validBody,
        ordersArr: [{ ...validOrderItem, createdAt: new Date().toISOString() }],
      }).success,
    ).toBe(false);
  });
});

describe("orderIdParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(orderIdParamsSchema.safeParse({ orderId: VALID_ID }).success).toBe(
      true,
    );
  });

  it.each([{}, { orderId: "invalid-id" }])("rejects %j", (params) => {
    expect(orderIdParamsSchema.safeParse(params).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      orderIdParamsSchema.safeParse({ orderId: VALID_ID, extra: "x" }).success,
    ).toBe(false);
  });
});

describe("ordersBySalesInstanceParamsSchema", () => {
  it("accepts a valid salesInstanceId", () => {
    expect(
      ordersBySalesInstanceParamsSchema.safeParse({ salesInstanceId: VALID_ID })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed salesInstanceId", () => {
    expect(
      ordersBySalesInstanceParamsSchema.safeParse({ salesInstanceId: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("ordersByUserParamsSchema", () => {
  it("accepts a valid userId", () => {
    expect(
      ordersByUserParamsSchema.safeParse({ userId: VALID_ID }).success,
    ).toBe(true);
  });

  it("rejects a malformed userId", () => {
    expect(
      ordersByUserParamsSchema.safeParse({ userId: "nope" }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every orders DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createOrderBodySchema,
    orderIdParamsSchema,
    ordersBySalesInstanceParamsSchema,
    ordersByUserParamsSchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("createdByUserId");
      expect(keys).not.toContain("createdAsRole");
      expect(keys).not.toContain("billingStatus");
      expect(keys).not.toContain("orderStatus");
      expect(keys).not.toContain("discountPercentage");
    },
  );
});
