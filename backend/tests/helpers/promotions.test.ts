/**
 * Promotion Helpers Tests - Task 0.6
 * Tests for applyPromotionsToOrders and validatePromotionType
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { validatePromotionType } from "../../src/promotions/validatePromotionType.ts";
import { applyPromotionsToOrders } from "../../src/promotions/applyPromotions.ts";
import Promotion from "../../src/models/promotion.ts";

describe("Promotion Helpers", () => {
  const businessId = new Types.ObjectId();
  const businessGoodId = new Types.ObjectId();

  describe("validatePromotionType", () => {
    it("returns true for valid fixedPrice", () => {
      expect(validatePromotionType({ fixedPrice: 10 })).toBe(true);
    });

    it("returns true for valid discountPercent", () => {
      expect(validatePromotionType({ discountPercent: 20 })).toBe(true);
    });

    it("returns true for valid twoForOne", () => {
      expect(validatePromotionType({ twoForOne: true })).toBe(true);
    });

    it("returns true for valid threeForTwo", () => {
      expect(validatePromotionType({ threeForTwo: true })).toBe(true);
    });

    it("returns true for valid secondHalfPrice", () => {
      expect(validatePromotionType({ secondHalfPrice: true })).toBe(true);
    });

    it("returns true for valid fullComplimentary", () => {
      expect(validatePromotionType({ fullComplimentary: true })).toBe(true);
    });

    it("returns error for null/undefined", () => {
      expect(validatePromotionType(null as any)).toBe("Promotion type is a required object!");
      expect(validatePromotionType(undefined as any)).toBe("Promotion type is a required object!");
    });

    it("returns error for multiple keys", () => {
      expect(validatePromotionType({ fixedPrice: 10, discountPercent: 20 })).toBe(
        "Promotion type must have only one key and one value!"
      );
    });

    it("returns error for empty object", () => {
      expect(validatePromotionType({})).toBe(
        "Promotion type must have only one key and one value!"
      );
    });

    it("returns error for invalid key", () => {
      expect(validatePromotionType({ invalidKey: 10 })).toBe("Invalid promotion type key!");
    });

    it("returns error for wrong type - fixedPrice should be number", () => {
      const result = validatePromotionType({ fixedPrice: "ten" as any });
      expect(result).toContain("Invalid type for fixedPrice");
      expect(result).toContain("Expected number");
    });

    it("returns error for wrong type - twoForOne should be boolean", () => {
      const result = validatePromotionType({ twoForOne: 1 as any });
      expect(result).toContain("Invalid type for twoForOne");
      expect(result).toContain("Expected boolean");
    });
  });

  describe("applyPromotionsToOrders", () => {
    it("returns error for empty orders array", async () => {
      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr: [],
      });

      expect(result).toBe("ordersArr must contain at least one order to apply promotions!");
    });

    it("returns orders unchanged when no promotions exist", async () => {
      const ordersArr = [
        {
          orderGrossPrice: 100,
          businessGoodId,
        },
      ];

      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].orderGrossPrice).toBe(100);
        expect(result[0].orderNetPrice).toBe(100);
        expect(result[0].promotionApplyed).toBeUndefined();
      }
    });

    it("applies discount percent promotion correctly", async () => {
      const now = new Date();
      const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      await Promotion.create({
        businessId,
        promotionName: "20% Off",
        activePromotion: true,
        promotionPeriod: {
          start: new Date(now.getTime() - 86400000), // yesterday
          end: new Date(now.getTime() + 86400000), // tomorrow
        },
        weekDays: weekDays, // all days
        promotionType: {
          discountPercent: 20,
        },
      });

      const ordersArr = [
        {
          orderGrossPrice: 100,
          businessGoodId,
        },
      ];

      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr,
        atDateTime: now,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].orderGrossPrice).toBe(100);
        expect(result[0].orderNetPrice).toBe(80); // 100 - 20%
        expect(result[0].promotionApplyed).toBe("20% Off");
        expect(result[0].discountPercentage).toBe(20);
      }
    });

    it("applies fixed price promotion correctly", async () => {
      const now = new Date();
      const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      await Promotion.create({
        businessId,
        promotionName: "Fixed Price Deal",
        activePromotion: true,
        promotionPeriod: {
          start: new Date(now.getTime() - 86400000),
          end: new Date(now.getTime() + 86400000),
        },
        weekDays: weekDays,
        promotionType: {
          fixedPrice: 50,
        },
      });

      const ordersArr = [
        {
          orderGrossPrice: 100,
          businessGoodId,
        },
      ];

      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr,
        atDateTime: now,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].orderGrossPrice).toBe(100);
        expect(result[0].orderNetPrice).toBe(50);
        expect(result[0].promotionApplyed).toBe("Fixed Price Deal");
      }
    });

    it("applies fullComplimentary promotion correctly", async () => {
      const now = new Date();
      const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      await Promotion.create({
        businessId,
        promotionName: "Free Item",
        activePromotion: true,
        promotionPeriod: {
          start: new Date(now.getTime() - 86400000),
          end: new Date(now.getTime() + 86400000),
        },
        weekDays: weekDays,
        promotionType: {
          fullComplimentary: true,
        },
      });

      const ordersArr = [
        {
          orderGrossPrice: 100,
          businessGoodId,
        },
      ];

      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr,
        atDateTime: now,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].orderGrossPrice).toBe(100);
        expect(result[0].orderNetPrice).toBe(0);
        expect(result[0].discountPercentage).toBe(100);
      }
    });

    it("selects best promotion when multiple apply", async () => {
      const now = new Date();
      const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      // Create two promotions - 10% and 30%
      await Promotion.create([
        {
          businessId,
          promotionName: "10% Off",
          activePromotion: true,
          promotionPeriod: {
            start: new Date(now.getTime() - 86400000),
            end: new Date(now.getTime() + 86400000),
          },
          weekDays: weekDays,
          promotionType: { discountPercent: 10 },
        },
        {
          businessId,
          promotionName: "30% Off",
          activePromotion: true,
          promotionPeriod: {
            start: new Date(now.getTime() - 86400000),
            end: new Date(now.getTime() + 86400000),
          },
          weekDays: weekDays,
          promotionType: { discountPercent: 30 },
        },
      ]);

      const ordersArr = [
        {
          orderGrossPrice: 100,
          businessGoodId,
        },
      ];

      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr,
        atDateTime: now,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].orderNetPrice).toBe(70); // Best discount: 30% off
        expect(result[0].promotionApplyed).toBe("30% Off");
      }
    });

    it("does not apply inactive promotions", async () => {
      const now = new Date();
      const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      await Promotion.create({
        businessId,
        promotionName: "Inactive Promo",
        activePromotion: false, // inactive
        promotionPeriod: {
          start: new Date(now.getTime() - 86400000),
          end: new Date(now.getTime() + 86400000),
        },
        weekDays: weekDays,
        promotionType: { discountPercent: 50 },
      });

      const ordersArr = [
        {
          orderGrossPrice: 100,
          businessGoodId,
        },
      ];

      const result = await applyPromotionsToOrders({
        businessId,
        ordersArr,
        atDateTime: now,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].orderNetPrice).toBe(100); // No discount applied
        expect(result[0].promotionApplyed).toBeUndefined();
      }
    });
  });
});
