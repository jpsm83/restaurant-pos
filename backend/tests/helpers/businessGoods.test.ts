/**
 * BusinessGoods Helpers Tests - Task 0.10
 * Tests for calculateIngredientsCostPriceAndAllergies
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import calculateIngredientsCostPriceAndAllergies from "../../src/businessGoods/calculateIngredientsCostPriceAndAllergies.ts";
import { calculateSetMenuCostPriceAndAllergies } from "../../src/businessGoods/calculateSetMenuCostPriceAndAllergies.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Supplier from "../../src/models/supplier.ts";

describe("BusinessGoods Helpers", () => {
  const businessId = new Types.ObjectId();
  let supplierId: Types.ObjectId;

  beforeEach(async () => {
    const supplier = await Supplier.create({
      businessId,
      tradeName: "Test Supplier",
      legalName: "Test Supplier Legal",
      taxNumber: "TAX-SUP-001",
      email: "supplier@test.com",
      phoneNumber: "1234567890",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
      contactPerson: "John Doe",
    });
    supplierId = supplier._id;
  });

  describe("calculateIngredientsCostPriceAndAllergies", () => {
    it("calculates cost correctly for same measurement unit", async () => {
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Flour",
        keyword: "flour",
        mainCategory: "Food",
        subCategory: "Baking",
        currentlyInUse: true,
        measurementUnit: "kg",
        pricePerMeasurementUnit: 2.5,
        parLevel: 10,
        allergens: ["Gluten"],
      });

      const ingredients = [
        {
          supplierGoodId: supplierGood._id,
          measurementUnit: "kg",
          requiredQuantity: 2,
        },
      ];

      const result = await calculateIngredientsCostPriceAndAllergies(ingredients as any);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].costOfRequiredQuantity).toBe(5); // 2.5 * 2
        expect(result[0].allergens).toEqual(["Gluten"]);
      }
    });

    it("calculates cost correctly with unit conversion", async () => {
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Sugar",
        keyword: "sugar",
        mainCategory: "Food",
        subCategory: "Baking",
        currentlyInUse: true,
        measurementUnit: "kg",
        pricePerMeasurementUnit: 3,
        parLevel: 5,
      });

      const ingredients = [
        {
          supplierGoodId: supplierGood._id,
          measurementUnit: "g",
          requiredQuantity: 500, // 0.5 kg
        },
      ];

      const result = await calculateIngredientsCostPriceAndAllergies(ingredients as any);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].costOfRequiredQuantity).toBeCloseTo(1.5, 2); // 3 * 0.5
      }
    });

    it("handles empty ingredients array", async () => {
      const result = await calculateIngredientsCostPriceAndAllergies([]);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(0);
      }
    });

    it("aggregates allergies correctly from multiple ingredients", async () => {
      const flour = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Flour",
        keyword: "flour",
        mainCategory: "Food",
        subCategory: "Baking",
        currentlyInUse: true,
        measurementUnit: "kg",
        pricePerMeasurementUnit: 2,
        parLevel: 10,
        allergens: ["Gluten"],
      });

      const milk = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Milk",
        keyword: "milk",
        mainCategory: "Food",
        subCategory: "Fresh",
        currentlyInUse: true,
        measurementUnit: "l",
        pricePerMeasurementUnit: 1.5,
        parLevel: 20,
        allergens: ["Milk"],
      });

      const ingredients = [
        { supplierGoodId: flour._id, measurementUnit: "kg", requiredQuantity: 1 },
        { supplierGoodId: milk._id, measurementUnit: "l", requiredQuantity: 0.5 },
      ];

      const result = await calculateIngredientsCostPriceAndAllergies(ingredients as any);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].allergens).toEqual(["Gluten"]);
        expect(result[1].allergens).toEqual(["Milk"]);
      }
    });

    it("returns error for non-existent supplier good", async () => {
      const fakeId = new Types.ObjectId();
      const ingredients = [
        { supplierGoodId: fakeId, measurementUnit: "kg", requiredQuantity: 1 },
      ];

      const result = await calculateIngredientsCostPriceAndAllergies(ingredients as any);

      expect(result).toBe("Supplier good not found!");
    });

    it("handles ingredient without allergens", async () => {
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Water",
        keyword: "water",
        mainCategory: "Beverage",
        subCategory: "Non-Alcoholic",
        currentlyInUse: true,
        measurementUnit: "l",
        pricePerMeasurementUnit: 0.5,
        parLevel: 50,
      });

      const ingredients = [
        { supplierGoodId: supplierGood._id, measurementUnit: "l", requiredQuantity: 2 },
      ];

      const result = await calculateIngredientsCostPriceAndAllergies(ingredients as any);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].allergens).toBeUndefined();
        expect(result[0].costOfRequiredQuantity).toBe(1); // 0.5 * 2
      }
    });

    it("handles unit measurement type", async () => {
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Eggs",
        keyword: "eggs",
        mainCategory: "Food",
        subCategory: "Fresh",
        currentlyInUse: true,
        measurementUnit: "unit",
        pricePerMeasurementUnit: 0.25,
        parLevel: 100,
        allergens: ["Eggs"],
      });

      const ingredients = [
        { supplierGoodId: supplierGood._id, measurementUnit: "unit", requiredQuantity: 4 },
      ];

      const result = await calculateIngredientsCostPriceAndAllergies(ingredients as any);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].costOfRequiredQuantity).toBe(1); // 0.25 * 4
      }
    });

    it("prices a soft-deleted supplier good from its measurement unit", async () => {
      const live = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Flour live",
        keyword: "flour-live",
        mainCategory: "Food",
        subCategory: "Baking",
        currentlyInUse: true,
        measurementUnit: "kg",
        pricePerMeasurementUnit: 2,
        parLevel: 10,
        allergens: ["Gluten"],
      });
      const retired = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Nuts retired",
        keyword: "nuts-retired",
        mainCategory: "Food",
        subCategory: "Baking",
        currentlyInUse: true,
        measurementUnit: "kg",
        pricePerMeasurementUnit: 8,
        parLevel: 10,
        allergens: ["Nuts"],
        deleted: true,
        deletedAt: new Date(),
      });

      const result = await calculateIngredientsCostPriceAndAllergies([
        { supplierGoodId: live._id, measurementUnit: "kg", requiredQuantity: 2 },
        { supplierGoodId: retired._id, measurementUnit: "g", requiredQuantity: 500 },
      ] as any);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
        expect(result[0].costOfRequiredQuantity).toBe(4);
        expect(result[0].allergens).toEqual(["Gluten"]);
        expect(result[1].costOfRequiredQuantity).toBe(4);
        expect(result[1].allergens).toEqual(["Nuts"]);
      }
    });
  });

  describe("calculateSetMenuCostPriceAndAllergies", () => {
    it("includes a soft-deleted component in the set-menu cost and allergens", async () => {
      const live = await BusinessGood.create({
        businessId,
        name: "Live component",
        keyword: "live-component",
        mainCategory: "Food",
        sellingPrice: 10,
        costPrice: 4,
        allergens: ["Gluten"],
      });
      const retired = await BusinessGood.create({
        businessId,
        name: "Retired component",
        keyword: "retired-component",
        mainCategory: "Food",
        sellingPrice: 12,
        costPrice: 9,
        allergens: ["Nuts"],
        deleted: true,
        deletedAt: new Date(),
      });

      const result = await calculateSetMenuCostPriceAndAllergies([
        live._id,
        retired._id,
      ]);

      expect(result).toMatchObject({ costPrice: 13 });
      if (typeof result === "object") {
        expect(result.allergens).toEqual(
          expect.arrayContaining(["Gluten", "Nuts"]),
        );
        expect(result.allergens).toHaveLength(2);
      }
    });
  });
});
