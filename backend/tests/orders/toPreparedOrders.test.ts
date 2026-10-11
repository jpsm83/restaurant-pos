import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import toPreparedOrders from "../../src/orders/toPreparedOrders.ts";

describe("toPreparedOrders", () => {
  const goodId = new Types.ObjectId().toString();
  const addOnId = new Types.ObjectId().toString();

  it("maps DTO order lines to Partial<IOrder> with ObjectId relations", () => {
    const prepared = toPreparedOrders([
      {
        businessGoodId: goodId,
        addOns: [addOnId],
        orderGrossPrice: 10,
        orderNetPrice: 8,
        orderCostPrice: 3,
        allergens: ["Gluten"],
        promotionApplyed: "Half Off",
        comments: "no salt",
      },
    ]);

    expect(prepared).toHaveLength(1);
    expect(prepared[0].businessGoodId).toBeInstanceOf(Types.ObjectId);
    expect(prepared[0].businessGoodId?.toString()).toBe(goodId);
    expect(prepared[0].addOns?.[0]).toBeInstanceOf(Types.ObjectId);
    expect(prepared[0].addOns?.[0]?.toString()).toBe(addOnId);
    expect(prepared[0]).toMatchObject({
      orderGrossPrice: 10,
      orderNetPrice: 8,
      orderCostPrice: 3,
      allergens: ["Gluten"],
      promotionApplyed: "Half Off",
      comments: "no salt",
    });
  });

  it("leaves optional addOns undefined when omitted", () => {
    const prepared = toPreparedOrders([
      {
        businessGoodId: goodId,
        orderGrossPrice: 1,
        orderNetPrice: 1,
        orderCostPrice: 0,
      },
    ]);

    expect(prepared[0].addOns).toBeUndefined();
  });
});
