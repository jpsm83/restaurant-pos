import { describe, it, expect } from "vitest";

import {
  createDeliveryOrderBodySchema,
  createSalesInstanceBodySchema,
  createSelfOrderBodySchema,
  deliveryAddressSchema,
  openSelfOrderingTableBodySchema,
  paymentMethodItemSchema,
  salesInstanceIdParamsSchema,
  salesInstanceStatusValues,
  salesInstancesByBusinessParamsSchema,
  salesInstancesByUserParamsSchema,
  selfOrderingLocationIdParamsSchema,
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

const validAddress = {
  country: "USA",
  state: "CA",
  city: "LA",
  street: "Main",
  buildingNumber: "1",
  postCode: "90001",
};

const validOrder = {
  businessGoodId: VALID_ID,
  orderGrossPrice: 10,
  orderNetPrice: 10,
  orderCostPrice: 3,
};

const validPayment = {
  paymentMethodType: "Cash",
  methodBranch: "Cash",
  methodSalesTotal: 10,
};

describe("deliveryAddressSchema", () => {
  it("accepts the required fields", () => {
    expect(deliveryAddressSchema.safeParse(validAddress).success).toBe(true);
  });

  it("accepts the optional fields and coordinates", () => {
    const parsed = deliveryAddressSchema.parse({
      ...validAddress,
      doorNumber: "3A",
      complement: "floor 2",
      region: "West",
      additionalDetails: "ring the bell",
      coordinates: [10, 20],
    });
    expect(parsed.doorNumber).toBe("3A");
    expect(parsed.coordinates).toEqual([10, 20]);
  });

  it("sanitizes a text field", () => {
    const parsed = deliveryAddressSchema.parse({
      ...validAddress,
      city: "  <b>Los</b>   Angeles ",
    });
    expect(parsed.city).toBe("Los Angeles");
  });

  it("rejects a missing or empty required field", () => {
    expect(
      deliveryAddressSchema.safeParse({ ...validAddress, postCode: undefined })
        .success,
    ).toBe(false);
    expect(
      deliveryAddressSchema.safeParse({ ...validAddress, city: "   " }).success,
    ).toBe(false);
  });

  it("rejects a malformed coordinates tuple", () => {
    expect(
      deliveryAddressSchema.safeParse({ ...validAddress, coordinates: [10] })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      deliveryAddressSchema.safeParse({ ...validAddress, extra: "x" }).success,
    ).toBe(false);
  });
});

describe("selfOrderingLocationIdParamsSchema", () => {
  it("accepts a valid id and rejects a malformed one", () => {
    expect(
      selfOrderingLocationIdParamsSchema.safeParse({
        selfOrderingLocationId: VALID_ID,
      }).success,
    ).toBe(true);
    expect(
      selfOrderingLocationIdParamsSchema.safeParse({
        selfOrderingLocationId: "bad",
      }).success,
    ).toBe(false);
  });
});

describe("openSelfOrderingTableBodySchema", () => {
  it("defaults guests to 1 when omitted", () => {
    const parsed = openSelfOrderingTableBodySchema.parse({ businessId: VALID_ID });
    expect(parsed.guests).toBe(1);
  });

  it("coerces a string guest count", () => {
    const parsed = openSelfOrderingTableBodySchema.parse({
      businessId: VALID_ID,
      guests: "3",
    });
    expect(parsed.guests).toBe(3);
  });

  it("rejects a missing businessId and unknown keys", () => {
    expect(openSelfOrderingTableBodySchema.safeParse({}).success).toBe(false);
    expect(
      openSelfOrderingTableBodySchema.safeParse({
        businessId: VALID_ID,
        openedByUserId: VALID_ID,
      }).success,
    ).toBe(false);
  });
});

describe("createDeliveryOrderBodySchema", () => {
  const validDelivery = {
    businessId: VALID_ID,
    ordersArr: [validOrder],
    paymentMethodArr: [validPayment],
    paymentId: "pay-123",
  };

  it("accepts a valid delivery body", () => {
    expect(createDeliveryOrderBodySchema.safeParse(validDelivery).success).toBe(
      true,
    );
  });

  it("accepts an optional deliveryAddress", () => {
    const parsed = createDeliveryOrderBodySchema.parse({
      ...validDelivery,
      deliveryAddress: validAddress,
    });
    expect(parsed.deliveryAddress?.city).toBe("LA");
  });

  it("requires paymentId", () => {
    expect(
      createDeliveryOrderBodySchema.safeParse({
        businessId: VALID_ID,
        ordersArr: [validOrder],
        paymentMethodArr: [validPayment],
      }).success,
    ).toBe(false);
    expect(
      createDeliveryOrderBodySchema.safeParse({
        ...validDelivery,
        paymentId: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed order id", () => {
    expect(
      createDeliveryOrderBodySchema.safeParse({
        ...validDelivery,
        ordersArr: [{ ...validOrder, businessGoodId: "bad" }],
      }).success,
    ).toBe(false);
  });

  it("rejects the server-owned salesInstanceStatus", () => {
    expect(
      createDeliveryOrderBodySchema.safeParse({
        ...validDelivery,
        salesInstanceStatus: "Occupied",
      }).success,
    ).toBe(false);
  });
});

describe("createSelfOrderBodySchema", () => {
  const validSelfOrder = {
    businessId: VALID_ID,
    ordersArr: [validOrder],
    paymentMethodArr: [validPayment],
    paymentId: "pay-456",
  };

  it("accepts a valid self-order body", () => {
    expect(createSelfOrderBodySchema.safeParse(validSelfOrder).success).toBe(
      true,
    );
  });

  it("requires ordersArr and paymentMethodArr", () => {
    expect(
      createSelfOrderBodySchema.safeParse({
        businessId: VALID_ID,
        ordersArr: [validOrder],
        paymentId: "pay-456",
      }).success,
    ).toBe(false);
    expect(
      createSelfOrderBodySchema.safeParse({
        businessId: VALID_ID,
        paymentMethodArr: [validPayment],
        paymentId: "pay-456",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createSelfOrderBodySchema.safeParse({
        ...validSelfOrder,
        dailyReferenceNumber: 1,
      }).success,
    ).toBe(false);
  });
});
