/**
 * Inventory Helpers Tests - Task 0.5
 * Tests for inventory utility functions
 */

import { describe, it, expect, beforeEach } from "vitest";
import mongoose, { Types } from "mongoose";
import Inventory from "../../src/models/inventory.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Supplier from "../../src/models/supplier.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import checkLowStockAndNotify from "../../src/inventories/checkLowStockAndNotify.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import updateDynamicCountSupplierGood from "../../src/inventories/updateDynamicCountSupplierGood.ts";

describe("Inventory Helpers", () => {
  const businessId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  describe("checkLowStockAndNotify", () => {
    it("does nothing when no inventory exists", async () => {
      await checkLowStockAndNotify(businessId);
      
      const notifications = await Notification.find({ businessId });
      expect(notifications.length).toBe(0);
    });

    it("does nothing when inventory has no goods", async () => {
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });

      await checkLowStockAndNotify(businessId);
      
      const notifications = await Notification.find({ businessId });
      expect(notifications.length).toBe(0);
    });

    it("does nothing when stock is above par level", async () => {
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Test Supplier",
        legalName: "Test Supplier LLC",
        taxNumber: "TAX-SUP-001",
        email: "supplier@test.com",
        phoneNumber: "123456789",
        address: {
          country: "US",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Test Item",
        keyword: "test-item",
        mainCategory: "Beverage",
        measurementUnit: "kg",
        parLevel: 10,
        pricePerMeasurementUnit: 5,
      });

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId: supplierGood._id,
            dynamicSystemCount: 20, // Above par level
            monthlyCounts: [],
          },
        ],
      });

      await checkLowStockAndNotify(businessId);
      
      const notifications = await Notification.find({ businessId });
      expect(notifications.length).toBe(0);
    });

    it("creates notification when stock is below par level and managers on duty", async () => {
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Test Supplier 2",
        legalName: "Test Supplier 2 LLC",
        taxNumber: "TAX-SUP-002",
        email: "supplier2@test.com",
        phoneNumber: "123456780",
        address: {
          country: "US",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "124",
          postCode: "90001",
        },
      });

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Low Stock Item",
        keyword: "low-stock-item",
        mainCategory: "Beverage",
        measurementUnit: "kg",
        parLevel: 10,
        pricePerMeasurementUnit: 5,
      });

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId: supplierGood._id,
            dynamicSystemCount: 5, // Below par level of 10
            monthlyCounts: [],
          },
        ],
      });

      // Create manager on duty
      await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: true,
        active: true,
        taxNumber: "TAX-LOW-001",
        joinDate: new Date(),
        vacationDaysPerYear: 20,
      });

      await checkLowStockAndNotify(businessId);
      
      const notifications = await Notification.find({ businessId });
      expect(notifications.length).toBe(1);
      expect(notifications[0].notificationType).toBe("Warning");
      expect(notifications[0].message).toContain("Low stock");
      expect(notifications[0].message).toContain("Low Stock Item");
    });

    it("does nothing when no managers are on duty", async () => {
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Test Supplier 3",
        legalName: "Test Supplier 3 LLC",
        taxNumber: "TAX-SUP-003",
        email: "supplier3@test.com",
        phoneNumber: "123456781",
        address: {
          country: "US",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "125",
          postCode: "90001",
        },
      });

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Another Low Item",
        keyword: "another-low-item",
        mainCategory: "Beverage",
        measurementUnit: "kg",
        parLevel: 10,
        pricePerMeasurementUnit: 5,
      });

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId: supplierGood._id,
            dynamicSystemCount: 3, // Below par level
            monthlyCounts: [],
          },
        ],
      });

      // Create employee who is NOT a manager
      await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Waiter"],
        currentShiftRole: "Waiter",
        onDuty: true,
        active: true,
        taxNumber: "TAX-WAITER-001",
        joinDate: new Date(),
        vacationDaysPerYear: 20,
      });

      await checkLowStockAndNotify(businessId);
      
      const notifications = await Notification.find({ businessId });
      expect(notifications.length).toBe(0);
    });

  });

  describe("getVarianceReport", () => {
    it("returns empty array when no data exists", async () => {
      // Import dynamically to avoid issues
      const { default: getVarianceReport } = await import("../../src/inventories/getVarianceReport.ts");
      
      const result = await getVarianceReport(businessId, 2025, 1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("updateDynamicCountSupplierGood", () => {
    const menuGood = (name: string, extra: Record<string, unknown> = {}) =>
      BusinessGood.create({
        businessId,
        name,
        keyword: name,
        mainCategory: "Food",
        sellingPrice: 5,
        ...extra,
      });

    const runCount = async (ids: Types.ObjectId[]) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        return await updateDynamicCountSupplierGood(ids, "remove", session);
      } finally {
        await session.abortTransaction().catch(() => undefined);
        session.endSession();
      }
    };

    it("does not move stock when a soft-deleted good has no recipe", async () => {
      const good = await menuGood("retired-plate", {
        deleted: true,
        deletedAt: new Date(),
      });

      expect(await runCount([good._id])).toBe(true);
    });

    it("still moves stock for a soft-deleted recipe", async () => {
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Recipe Supplier",
        legalName: "Recipe Supplier LLC",
        taxNumber: "TAX-RECIPE-001",
        email: "recipe-supplier@test.com",
        phoneNumber: "123456789",
        address: {
          country: "US",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Flour",
        keyword: "flour",
        mainCategory: "Food",
        measurementUnit: "kg",
        parLevel: 10,
        pricePerMeasurementUnit: 5,
      });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId: supplierGood._id,
            dynamicSystemCount: 10,
            monthlyCounts: [],
          },
        ],
      });
      const good = await menuGood("retired-recipe", {
        deleted: true,
        deletedAt: new Date(),
        ingredients: [
          {
            supplierGoodId: supplierGood._id,
            measurementUnit: "kg",
            requiredQuantity: 2,
          },
        ],
      });

      const session = await mongoose.startSession();
      session.startTransaction();
      const result = await updateDynamicCountSupplierGood(
        [good._id],
        "remove",
        session,
      );
      await session.commitTransaction();
      session.endSession();

      expect(result).toBe(true);
      const inventory = await Inventory.findOne({ businessId }).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(8);
    });

    it("still moves stock for a soft-deleted set-menu component", async () => {
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Combo Supplier",
        legalName: "Combo Supplier LLC",
        taxNumber: "TAX-COMBO-001",
        email: "combo-supplier@test.com",
        phoneNumber: "123456789",
        address: {
          country: "US",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Bun",
        keyword: "bun",
        mainCategory: "Food",
        measurementUnit: "kg",
        parLevel: 10,
        pricePerMeasurementUnit: 5,
      });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId: supplierGood._id,
            dynamicSystemCount: 10,
            monthlyCounts: [],
          },
        ],
      });
      const component = await menuGood("retired-component", {
        deleted: true,
        deletedAt: new Date(),
        ingredients: [
          {
            supplierGoodId: supplierGood._id,
            measurementUnit: "kg",
            requiredQuantity: 1,
          },
        ],
      });
      const combo = await menuGood("live-combo", {
        setMenuIds: [component._id],
      });

      const session = await mongoose.startSession();
      session.startTransaction();
      const result = await updateDynamicCountSupplierGood(
        [combo._id],
        "remove",
        session,
      );
      await session.commitTransaction();
      session.endSession();

      expect(result).toBe(true);
      const inventory = await Inventory.findOne({ businessId }).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(9);
    });

    it("reports an id that was never a business good", async () => {
      expect(await runCount([new Types.ObjectId()])).toBe(
        "Business goods not found!",
      );
    });
  });

  describe("createNextPeriodInventory", () => {
    it("function exists and is callable", async () => {
      const { default: createNextPeriodInventory } = await import(
        "../../src/inventories/createNextPeriodInventory.ts"
      );
      expect(typeof createNextPeriodInventory).toBe("function");
    });
  });
});
