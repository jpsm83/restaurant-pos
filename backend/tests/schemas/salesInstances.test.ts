import { describe, it, expect } from "vitest";

import {
  createSalesInstanceBodySchema,
  paymentMethodItemSchema,
  salesInstanceIdParamsSchema,
  salesInstanceStatusValues,
  salesInstancesByBusinessParamsSchema,
  salesInstancesByUserParamsSchema,
  transferSalesPointBodySchema,
  updateSalesInstanceBodySchema,
} from "../../../packages/schemas/salesInstances.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

const createValid = {
  salesPointId: VALID_ID,
  guests: 2,
  businessId: OTHER_ID,
};

describe("createSalesInstanceBodySchema", () => {
  it("accepts the minimum required fields", () => {
    expect(createSalesInstanceBodySchema.safeParse(createValid).success).toBe(
      true,
    );
  });

  it("coerces a string guest count", () => {
    const parsed = createSalesInstanceBodySchema.parse({
      ...createValid,
      guests: "4",
    });
    expect(parsed.guests).toBe(4);
  });

  it("rejects a missing salesPointId, guests or businessId", () => {
    expect(createSalesInstanceBodySchema.safeParse({}).success).toBe(false);
    expect(
      createSalesInstanceBodySchema.safeParse({ ...createValid, guests: undefined })
        .success,
    ).toBe(false);
    expect(
      createSalesInstanceBodySchema.safeParse({
        ...createValid,
        businessId: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive guest count", () => {
    expect(
      createSalesInstanceBodySchema.safeParse({ ...createValid, guests: 0 })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed salesPointId", () => {
    expect(
      createSalesInstanceBodySchema.safeParse({
        ...createValid,
        salesPointId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("sanitizes the clientName", () => {
    const parsed = createSalesInstanceBodySchema.parse({
      ...createValid,
      clientName: "  <b>John</b>   Doe ",
    });
    expect(parsed.clientName).toBe("John Doe");
  });

  it("accepts every shared salesInstance status", () => {
    for (const status of salesInstanceStatusValues) {
      expect(
        createSalesInstanceBodySchema.safeParse({
          ...createValid,
          salesInstanceStatus: status,
        }).success,
        `${status} should be accepted`,
      ).toBe(true);
    }
  });

  it("rejects a status outside the enum", () => {
    expect(
      createSalesInstanceBodySchema.safeParse({
        ...createValid,
        salesInstanceStatus: "Bogus",
      }).success,
    ).toBe(false);
  });

  it("rejects the server-owned openedByUserId", () => {
    expect(
      createSalesInstanceBodySchema.safeParse({
        ...createValid,
        openedByUserId: VALID_ID,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createSalesInstanceBodySchema.safeParse({ ...createValid, isAdmin: true })
        .success,
    ).toBe(false);
  });
});

describe("updateSalesInstanceBodySchema", () => {
  it("accepts an empty update", () => {
    expect(updateSalesInstanceBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts an ObjectId array", () => {
    const parsed = updateSalesInstanceBodySchema.parse({
      ordersIdsArr: [VALID_ID, OTHER_ID],
    });
    expect(parsed.ordersIdsArr).toEqual([VALID_ID, OTHER_ID]);
  });

  it("rejects a malformed id inside ordersIdsArr", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({ ordersIdsArr: ["nope"] }).success,
    ).toBe(false);
  });

  it("coerces the discountPercentage and guests numbers", () => {
    const parsed = updateSalesInstanceBodySchema.parse({
      discountPercentage: "10",
      guests: "3",
    });
    expect(parsed.discountPercentage).toBe(10);
    expect(parsed.guests).toBe(3);
  });

  it("coerces the cancel boolean", () => {
    expect(
      updateSalesInstanceBodySchema.parse({ cancel: "true" }).cancel,
    ).toBe(true);
  });

  it("rejects an invalid salesInstanceStatus", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({ salesInstanceStatus: "Nope" })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid ordersNewBillingStatus", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({
        ordersNewBillingStatus: "Bogus",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed toSalesInstanceId", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({ toSalesInstanceId: "bad" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed paymentMethodArr entry", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({
        paymentMethodArr: [{ paymentMethodType: "Cash" }],
      }).success,
    ).toBe(false);
  });

  it("rejects the server-owned dailyReferenceNumber", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({ dailyReferenceNumber: 1 })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updateSalesInstanceBodySchema.safeParse({ openedAsRole: "employee" })
        .success,
    ).toBe(false);
  });
});

describe("paymentMethodItemSchema", () => {
  it("accepts a cash payment and coerces the total", () => {
    const parsed = paymentMethodItemSchema.parse({
      paymentMethodType: "Cash",
      methodBranch: "Cash",
      methodSalesTotal: "12.5",
    });
    expect(parsed.methodSalesTotal).toBe(12.5);
  });

  it("rejects unknown keys", () => {
    expect(
      paymentMethodItemSchema.safeParse({
        paymentMethodType: "Cash",
        methodBranch: "Cash",
        methodSalesTotal: 1,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("salesInstances params schemas", () => {
  it("accepts a valid salesInstanceId", () => {
    expect(
      salesInstanceIdParamsSchema.safeParse({ salesInstanceId: VALID_ID })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed salesInstanceId", () => {
    expect(
      salesInstanceIdParamsSchema.safeParse({ salesInstanceId: "invalid" })
        .success,
    ).toBe(false);
  });

  it("validates the business and user param ids", () => {
    expect(
      salesInstancesByBusinessParamsSchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      salesInstancesByUserParamsSchema.safeParse({ userId: "bad" }).success,
    ).toBe(false);
  });

  it("validates the transferSalesPoint body", () => {
    expect(
      transferSalesPointBodySchema.safeParse({ salesPointId: VALID_ID }).success,
    ).toBe(true);
    expect(
      transferSalesPointBodySchema.safeParse({ salesPointId: "bad" }).success,
    ).toBe(false);
  });
});
