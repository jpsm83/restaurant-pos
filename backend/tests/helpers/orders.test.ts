/**
 * Order Helpers Tests - Task 0.4
 * Tests for ordersArrValidation (createOrders/closeOrders/cancelOrders require replica set)
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { ordersArrValidation } from "../../src/orders/ordersArrValidation.js";

describe("Order Helpers", () => {
  describe("ordersArrValidation", () => {
    it("returns true for valid orders array", () => {
      const validOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
        },
      ];

      expect(ordersArrValidation(validOrders)).toBe(true);
    });

    it("returns true for multiple valid orders", () => {
      const validOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
        },
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 15.0,
          orderNetPrice: 12.5,
          orderCostPrice: 5.0,
        },
      ];

      expect(ordersArrValidation(validOrders)).toBe(true);
    });

    it("returns true for orders with valid addOns", () => {
      const validOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          addOns: [new Types.ObjectId(), new Types.ObjectId()],
        },
      ];

      expect(ordersArrValidation(validOrders)).toBe(true);
    });

    it("returns true for orders with optional comments", () => {
      const validOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          comments: "No onions please",
        },
      ];

      expect(ordersArrValidation(validOrders)).toBe(true);
    });

    it("returns true for orders with allergens", () => {
      const validOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          allergens: ["gluten", "dairy"],
        },
      ];

      expect(ordersArrValidation(validOrders)).toBe(true);
    });

    it("returns error for empty array", () => {
      expect(ordersArrValidation([])).toBe("OrdersArr must be an array of objects!");
    });

    it("returns error for non-array input", () => {
      expect(ordersArrValidation("not an array" as any)).toBe(
        "OrdersArr must be an array of objects!"
      );
    });

    it("returns error for array with non-objects", () => {
      expect(ordersArrValidation(["string", 123] as any)).toBe(
        "OrdersArr must be an array of objects!"
      );
    });

    it("returns error for missing businessGoodId", () => {
      const invalidOrders = [
        {
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe(
        "businessGoodId is required and must be a valid ObjectId!"
      );
    });

    it("returns error for invalid businessGoodId string", () => {
      const invalidOrders = [
        {
          businessGoodId: "invalid-id",
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe(
        "businessGoodId is required and must be a valid ObjectId!"
      );
    });

    it("returns error for missing orderGrossPrice", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe("orderGrossPrice must have a value!");
    });

    it("returns error for missing orderNetPrice", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderCostPrice: 3.0,
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe("orderNetPrice must have a value!");
    });

    it("returns error for missing orderCostPrice", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe("orderCostPrice must have a value!");
    });

    it("returns error for invalid addOns (not array)", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          addOns: "not-an-array",
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe(
        "addOns must be an array of valid ObjectIds when present!"
      );
    });

    it("returns error for invalid addOns (invalid ObjectIds)", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          addOns: ["invalid-id-1", "invalid-id-2"],
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe(
        "addOns must be an array of valid ObjectIds when present!"
      );
    });

    it("returns error for invalid keys in order object", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          invalidKey: "test",
        },
      ] as any;

      expect(ordersArrValidation(invalidOrders)).toBe("Invalid key: invalidKey");
    });

    it("returns error for multiple invalid keys", () => {
      const invalidOrders = [
        {
          businessGoodId: new Types.ObjectId(),
          orderGrossPrice: 10.0,
          orderNetPrice: 8.5,
          orderCostPrice: 3.0,
          badKey1: "test",
          badKey2: "test2",
        },
      ] as any;

      // Should return error for first invalid key found
      const result = ordersArrValidation(invalidOrders);
      expect(typeof result).toBe("string");
      expect(result).toContain("Invalid key:");
    });
  });
});
