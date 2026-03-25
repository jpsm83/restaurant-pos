/**
 * applyPromotionsToOrders — delivery vs seated promotion scope (Task 12)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import Business from "../../src/models/business.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Promotion from "../../src/models/promotion.ts";
import applyPromotionsToOrders from "../../src/promotions/applyPromotions.ts";

const allWeekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

describe("applyPromotionsToOrders delivery scope", () => {
  let businessId: Types.ObjectId;
  let goodId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Promo Biz",
      legalName: "Promo LLC",
      email: `promo-${Date.now()}@t.com`,
      password: "h",
      phoneNumber: "1",
      taxNumber: `TAX-PR-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main",
        buildingNumber: "1",
        postCode: "90001",
      },
    });
    businessId = business._id;

    const g = await BusinessGood.create({
      businessId,
      name: "Pie",
      keyword: "pie",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 100,
      costPrice: 20,
    });
    goodId = g._id;

    const period = {
      start: new Date(Date.now() - 86400000),
      end: new Date(Date.now() + 86400000),
    };

    await Promotion.create({
      businessId,
      promotionName: "Seated half off",
      promotionPeriod: period,
      weekDays: [...allWeekDays],
      activePromotion: true,
      promotionType: { discountPercent: 50 },
      applyToDelivery: false,
      businessGoodsToApplyIds: [goodId],
    });

    await Promotion.create({
      businessId,
      promotionName: "Delivery ten off",
      promotionPeriod: period,
      weekDays: [...allWeekDays],
      activePromotion: true,
      promotionType: { discountPercent: 10 },
      applyToDelivery: true,
      businessGoodsToApplyIds: [goodId],
    });
  });

  const orderLine = () => ({
    businessGoodId: goodId,
    orderGrossPrice: 100,
    orderNetPrice: 100,
    orderCostPrice: 20,
  });

  it("uses only applyToDelivery promotions when flow is delivery", async () => {
    const out = await applyPromotionsToOrders({
      businessId,
      ordersArr: [orderLine()],
      flow: "delivery",
    });
    expect(Array.isArray(out)).toBe(true);
    const row = (out as { orderNetPrice: number; promotionApplyed?: string }[])[0];
    expect(row.orderNetPrice).toBe(90);
    expect(row.promotionApplyed).toBe("Delivery ten off");
  });

  it("uses only non-delivery promotions when flow is seated", async () => {
    const out = await applyPromotionsToOrders({
      businessId,
      ordersArr: [orderLine()],
      flow: "seated",
    });
    expect(Array.isArray(out)).toBe(true);
    const row = (out as { orderNetPrice: number; promotionApplyed?: string }[])[0];
    expect(row.orderNetPrice).toBe(50);
    expect(row.promotionApplyed).toBe("Seated half off");
  });
});
