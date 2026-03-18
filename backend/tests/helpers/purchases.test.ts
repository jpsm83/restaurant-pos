/**
 * Purchase Helpers Tests - Task 0.12
 * Tests for validateInventoryPurchaseItems
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { validateInventoryPurchaseItems } from "../../src/purchases/validateInventoryPurchaseItems.js";

describe("Purchase Helpers", () => {
  describe("validateInventoryPurchaseItems", () => {
    it("returns true for valid purchase items", () => {
      const validItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 10,
          purchasePrice: 25.50,
        },
      ];

      const result = validateInventoryPurchaseItems(validItems as any, false);
      expect(result).toBe(true);
    });

    it("returns true for multiple valid items", () => {
      const validItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 10,
          purchasePrice: 25.50,
        },
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 5,
          purchasePrice: 100,
        },
      ];

      const result = validateInventoryPurchaseItems(validItems as any, false);
      expect(result).toBe(true);
    });

    it("returns error for non-array input", () => {
      const result = validateInventoryPurchaseItems("not an array" as any, false);
      expect(result).toBe("Purchase items is not an array or it is empty!");
    });

    it("returns error for empty array", () => {
      const result = validateInventoryPurchaseItems([], false);
      expect(result).toBe("Purchase items is not an array or it is empty!");
    });

    it("returns error for invalid supplierGoodId when not oneTimePurchase", () => {
      const invalidItems = [
        {
          supplierGoodId: "invalid-id",
          quantityPurchased: 10,
          purchasePrice: 25.50,
        },
      ];

      const result = validateInventoryPurchaseItems(invalidItems as any, false);
      expect(result).toBe("Incorrect supplier good Id!");
    });

    it("skips supplierGoodId validation for oneTimePurchase", () => {
      const items = [
        {
          supplierGoodId: "any-value",
          quantityPurchased: 10,
          purchasePrice: 25.50,
        },
      ];

      const result = validateInventoryPurchaseItems(items as any, true);
      expect(result).toBe(true);
    });

    it("returns error for missing quantityPurchased", () => {
      const invalidItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          purchasePrice: 25.50,
        },
      ];

      const result = validateInventoryPurchaseItems(invalidItems as any, false);
      expect(result).toBe("Incorrect quantity purchased!");
    });

    it("returns error for zero quantityPurchased", () => {
      const invalidItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 0,
          purchasePrice: 25.50,
        },
      ];

      const result = validateInventoryPurchaseItems(invalidItems as any, false);
      expect(result).toBe("Incorrect quantity purchased!");
    });

    it("returns error for missing purchasePrice", () => {
      const invalidItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 10,
        },
      ];

      const result = validateInventoryPurchaseItems(invalidItems as any, false);
      expect(result).toBe("Incorrect purchase price!");
    });

    it("returns error for zero purchasePrice", () => {
      const invalidItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 10,
          purchasePrice: 0,
        },
      ];

      const result = validateInventoryPurchaseItems(invalidItems as any, false);
      expect(result).toBe("Incorrect purchase price!");
    });

    it("validates each item in array", () => {
      const mixedItems = [
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 10,
          purchasePrice: 25.50,
        },
        {
          supplierGoodId: new Types.ObjectId(),
          quantityPurchased: 0, // invalid
          purchasePrice: 50,
        },
      ];

      const result = validateInventoryPurchaseItems(mixedItems as any, false);
      expect(result).toBe("Incorrect quantity purchased!");
    });
  });
});
