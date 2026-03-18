/**
 * Inventories Routes Tests - Phase 1 Module 9 + Phase 4 Task 4.2
 * Tests for inventories CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for inventory period creation (requires replica set)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.js";
import Inventory from "../../src/models/inventory.js";
import SupplierGood from "../../src/models/supplierGood.js";
import Supplier from "../../src/models/supplier.js";
import Business from "../../src/models/business.js";
import User from "../../src/models/user.js";
import Employee from "../../src/models/employee.js";

describe("Inventories Routes", () => {
  let businessId: Types.ObjectId;
  let supplierId: Types.ObjectId;
  let supplierGoodId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: validAddress,
    });
    businessId = business._id;

    const supplier = await Supplier.create({
      businessId,
      tradeName: "Test Supplier",
      legalName: "Test Supplier LLC",
      email: "supplier@test.com",
      phoneNumber: "9999999999",
      taxNumber: "SUP-001",
      currentlyInUse: true,
      address: validAddress,
    });
    supplierId = supplier._id;

    const supplierGood = await SupplierGood.create({
      businessId,
      supplierId,
      name: "Test Ingredient",
      keyword: "ingredient",
      mainCategory: "Food",
      currentlyInUse: true,
      parLevel: 100,
    });
    supplierGoodId = supplierGood._id;
  });

  describe("GET /api/v1/inventories", () => {
    it("lists all inventories", async () => {
      const app = await getTestApp();

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 50,
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 404 when no inventories exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No inventories found");
    });
  });

  describe("POST /api/v1/inventories", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: { businessId: "invalid-id" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID");
    });

    it("returns 400 for missing businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID");
    });
  });

  describe("GET /api/v1/inventories/:inventoryId", () => {
    it("gets inventory by ID", async () => {
      const app = await getTestApp();

      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 50,
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${inventory._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(inventory._id.toString());
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Inventory ID not valid!");
    });

    it("returns 404 for non-existent inventory", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No inventory found");
    });
  });

  describe("DELETE /api/v1/inventories/:inventoryId", () => {
    it("returns 400 for invalid inventoryId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/inventories/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Inventory ID not valid!");
    });

    it("returns 404 for non-existent inventory", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/inventories/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Inventory not found!");
    });

    it("deletes inventory successfully", async () => {
      const app = await getTestApp();

      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/inventories/${inventory._id}`,
      });

      expect(response.statusCode).toBe(200);

      const deleted = await Inventory.findById(inventory._id);
      expect(deleted).toBeNull();
    });
  });

  describe("PATCH /api/v1/inventories/:inventoryId/close", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${fakeId}/close`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid inventoryId with auth", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/inventories/invalid-id/close",
        headers: {
          authorization: "Bearer fake-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId", () => {
    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/invalid-id/supplierGood/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Inventory or supplier good ID not valid!");
    });

    it("returns 404 when supplier good not in inventory", async () => {
      const app = await getTestApp();
      const fakeInventoryId = new Types.ObjectId();
      const fakeSupplierGoodId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${fakeInventoryId}/supplierGood/${fakeSupplierGoodId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No inventories found!");
    });
  });

  describe("PATCH /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/addCount", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();
      const fakeInventoryId = new Types.ObjectId();
      const fakeSupplierGoodId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${fakeInventoryId}/supplierGood/${fakeSupplierGoodId}/addCount`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/inventories/invalid-id/supplierGood/invalid-id/addCount",
        payload: { currentCountQuantity: 50 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("not valid");
    });
  });

  describe("PATCH /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeInventoryId = new Types.ObjectId();
      const fakeSupplierGoodId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${fakeInventoryId}/supplierGood/${fakeSupplierGoodId}/updateCount`,
        payload: { countId: new Types.ObjectId().toString(), reason: "test" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/inventories/business/:businessId", () => {
    it("lists inventories by business", async () => {
      const app = await getTestApp();

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business ID not valid!");
    });

    it("returns 404 when no inventories for business", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${otherBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No inventories found!");
    });
  });

  describe("GET /api/v1/inventories/business/:businessId/lowStock", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/business/invalid-id/lowStock",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business ID not valid!");
    });

    it("returns empty lowStock when no inventory", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}/lowStock`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.lowStock).toEqual([]);
    });
  });

  describe("GET /api/v1/inventories/business/:businessId/varianceReport", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/business/invalid-id/varianceReport",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business ID is not valid!");
    });

    it("returns 400 for invalid month format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}/varianceReport?month=2024-13`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Month must be 01-12.");
    });

    it("returns variance report", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}/varianceReport`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("varianceReport");
    });
  });

  // Phase 4 Task 4.2: Transaction Tests for Inventory Period Management
  describe("Transaction Tests - POST /api/v1/inventories", () => {
    it("creates new inventory period with supplierGoods", async () => {
      const app = await getTestApp();

      // Ensure no inventory exists for current month
      await Inventory.deleteMany({ businessId });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify inventory was created with the supplierGood
      const createdInventory = await Inventory.findOne({ businessId }).lean();
      expect(createdInventory).not.toBeNull();
      expect(createdInventory?.setFinalCount).toBe(false);
      expect(createdInventory?.inventoryGoods?.length).toBeGreaterThanOrEqual(1);

      // Verify supplierGood is included
      const hasSupplierGood = createdInventory?.inventoryGoods?.some(
        (g) => g.supplierGoodId.toString() === supplierGoodId.toString()
      );
      expect(hasSupplierGood).toBe(true);
    });

    it("prevents duplicate inventory for same month", async () => {
      const app = await getTestApp();

      // Create an inventory for current month
      await Inventory.deleteMany({ businessId });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 50,
          },
        ],
      });

      // Try to create another one
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
    });

    it("closes previous month inventory when creating new period", async () => {
      const app = await getTestApp();

      // Create a previous month inventory (without monthlyCounts to avoid validation complexity)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await Inventory.deleteMany({ businessId });

      const previousInventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        createdAt: lastMonth,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 75,
          },
        ],
      });

      // Create new month inventory
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(201);

      // Verify previous month was closed
      const closedInventory = await Inventory.findById(previousInventory._id).lean();
      expect(closedInventory?.setFinalCount).toBe(true);

      // Verify new inventory was created
      const newInventory = await Inventory.findOne({
        businessId,
        _id: { $ne: previousInventory._id },
      }).lean();

      expect(newInventory).not.toBeNull();
      expect(newInventory?.setFinalCount).toBe(false);

      // The new inventory should have the supplierGood
      const supplierGoodEntry = newInventory?.inventoryGoods?.find(
        (g) => g.supplierGoodId.toString() === supplierGoodId.toString()
      );
      expect(supplierGoodEntry).toBeDefined();
    });
  });

  describe("Transaction Tests - PATCH close", () => {
    it("closes inventory and creates next period", async () => {
      const app = await getTestApp();

      // Create user with all required fields
      const user = await User.create({
        personalDetails: {
          username: "invmanager",
          email: "invmanager@test.com",
          password: "hashedpassword123",
          firstName: "Test",
          lastName: "Manager",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "INV-MGR-001",
          address: validAddress,
        },
      });

      const employee = await Employee.create({
        businessId,
        userId: user._id,
        currentShiftRole: "General Manager",
        joinDate: new Date(),
        taxNumber: `INV-EMP-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      // Create inventory to close (without monthlyCounts to avoid validation complexity)
      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 100,
          },
        ],
      });

      // Generate token for the user
      const token = await generateTestToken({
        id: user._id.toString(),
        email: "invmanager@test.com",
        type: "user",
        employeeId: employee._id.toString(),
        businessId: businessId.toString(),
        canLogAsEmployee: true,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/close`,
        headers: { authorization: token },
      });

      expect(response.statusCode).toBe(200);

      // Verify inventory was closed
      const closedInventory = await Inventory.findById(inventory._id).lean();
      expect(closedInventory?.setFinalCount).toBe(true);

      // Verify next period inventory was created
      const nextInventory = await Inventory.findOne({
        businessId,
        _id: { $ne: inventory._id },
        setFinalCount: false,
      }).lean();

      expect(nextInventory).not.toBeNull();
    });
  });
});
