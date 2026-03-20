/**
 * Purchases Routes Tests - Phase 1 Module 10 + Phase 4 Task 4.1
 * Tests for purchases CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests with inventory updates (requires replica set)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Purchase from "../../src/models/purchase.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Business from "../../src/models/business.ts";
import Employee from "../../src/models/employee.ts";
import User from "../../src/models/user.ts";
import Inventory from "../../src/models/inventory.ts";

describe("Purchases Routes", () => {
  let businessId: Types.ObjectId;
  let supplierId: Types.ObjectId;
  let supplierGoodId: Types.ObjectId;
  let employeeId: Types.ObjectId;
  let userId: Types.ObjectId;
  let inventoryId: Types.ObjectId;

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
    });
    supplierGoodId = supplierGood._id;

    // Create inventory with supplierGood for transaction tests
    const inventory = await Inventory.create({
      businessId,
      inventoryMonth: new Date().getMonth() + 1,
      inventoryYear: new Date().getFullYear(),
      setFinalCount: false,
      inventoryGoods: [
        {
          supplierGoodId,
          dynamicSystemCount: 100,
          countSchedule: [],
        },
      ],
    });
    inventoryId = inventory._id;

    const user = await User.create({
      username: "testuser",
      email: "purchaseuser@test.com",
      password: "hashedpassword",
      allUserRoles: ["employee"],
      personalDetails: {
        username: "testuser",
        email: "purchaseuser@test.com",
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        idType: "National ID",
        idNumber: "123456789",
        address: validAddress,
      },
    });
    userId = user._id;

    const employee = await Employee.create({
      businessId,
      userId,
      currentShiftRole: "Manager",
      taxNumber: "EMP-TAX-001",
      joinDate: new Date(),
      vacationDaysPerYear: 20,
    });
    employeeId = employee._id;
  });

  describe("GET /api/v1/purchases", () => {
    it("lists all purchases", async () => {
      const app = await getTestApp();

      await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-001",
        totalAmount: 100,
        purchaseInventoryItems: [
          {
            supplierGoodId,
            quantityPurchased: 10,
            purchasePrice: 100,
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 404 when no purchases exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No purchases found");
    });

    it("returns 400 for invalid date range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases?startDate=2024-12-31&endDate=2024-01-01",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid date range");
    });
  });

  describe("POST /api/v1/purchases", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: { supplierId: supplierId.toString() },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid businessId or employeeId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: {
          supplierId: supplierId.toString(),
          purchaseDate: new Date().toISOString(),
          businessId: "invalid-id",
          purchasedByEmployeeId: employeeId.toString(),
          receiptId: "REC-002",
          purchaseInventoryItems: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("not valid");
    });

    it("returns 400 for one time purchase without comment", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: {
          supplierId: "One Time Purchase",
          purchaseDate: new Date().toISOString(),
          businessId: businessId.toString(),
          purchasedByEmployeeId: employeeId.toString(),
          receiptId: "REC-003",
          purchaseInventoryItems: [
            { supplierGoodId: supplierGoodId.toString(), quantityPurchased: 5, purchasePrice: 50 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Comment is required");
    });
  });

  describe("GET /api/v1/purchases/:purchaseId", () => {
    it("gets purchase by ID", async () => {
      const app = await getTestApp();

      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-004",
        totalAmount: 50,
        purchaseInventoryItems: [],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/${purchase._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(purchase._id.toString());
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase ID not valid!");
    });

    it("returns 404 for non-existent purchase", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase not found!");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId", () => {
    it("returns 400 for missing businessId", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}`,
        payload: { title: "Updated" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business ID is required!");
    });

    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}`,
        payload: {
          businessId: "invalid-id",
          purchasedByEmployeeId: employeeId.toString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("not valid");
    });

    it("updates purchase successfully", async () => {
      const app = await getTestApp();

      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-005",
        totalAmount: 75,
        title: "Original Title",
        purchaseInventoryItems: [],
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}`,
        payload: {
          businessId: businessId.toString(),
          purchasedByEmployeeId: employeeId.toString(),
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase updated successfully!");
    });
  });

  describe("DELETE /api/v1/purchases/:purchaseId", () => {
    it("returns 400 for invalid purchaseId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/purchases/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase ID not valid!");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId/addSupplierGood", () => {
    it("returns 400 for invalid supplierGoodId", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}/addSupplierGood`,
        payload: {
          supplierGoodId: "invalid-id",
          quantityPurchased: 5,
          purchasePrice: 25,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("not valid");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId/deleteSupplierGood", () => {
    it("returns 400 for invalid purchaseId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/purchases/invalid-id/deleteSupplierGood",
        payload: { purchaseInventoryItemsId: new Types.ObjectId().toString() },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("not valid");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId/editSupplierGood", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}/editSupplierGood`,
        payload: {
          purchaseInventoryItemsId: new Types.ObjectId().toString(),
          newQuantityPurchased: 10,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 for requests without valid auth even with valid payload", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}/editSupplierGood`,
        payload: {
          purchaseInventoryItemsId: new Types.ObjectId().toString(),
          reason: "Test reason",
          newQuantityPurchased: 10,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/purchases/supplier/:supplierId", () => {
    it("lists purchases by supplier", async () => {
      const app = await getTestApp();

      await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-006",
        totalAmount: 200,
        purchaseInventoryItems: [],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/supplier/${supplierId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases/supplier/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase ID not valid!");
    });

    it("returns 404 when no purchases for supplier", async () => {
      const app = await getTestApp();
      const otherSupplierId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/supplier/${otherSupplierId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase not found!");
    });
  });

  describe("GET /api/v1/purchases/user/:userId", () => {
    it("lists purchases by user", async () => {
      const app = await getTestApp();

      await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-007",
        totalAmount: 150,
        purchaseInventoryItems: [],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/user/${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases/user/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User ID not valid!");
    });

    it("returns 404 when no purchases for user", async () => {
      const app = await getTestApp();
      const otherUserId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/user/${otherUserId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase not found!");
    });
  });

  // Phase 4 Task 4.1: Transaction Tests with Inventory Verification
  describe("Transaction Tests - POST /api/v1/purchases", () => {
    it("creates purchase and updates inventory count", async () => {
      const app = await getTestApp();

      // Get initial inventory count
      const initialInventory = await Inventory.findById(inventoryId).lean();
      const initialCount = initialInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: {
          supplierId: supplierId.toString(),
          purchaseDate: new Date().toISOString(),
          businessId: businessId.toString(),
          purchasedByEmployeeId: employeeId.toString(),
          receiptId: `REC-TRANS-${Date.now()}`,
          purchaseInventoryItems: [
            {
              supplierGoodId: supplierGoodId.toString(),
              quantityPurchased: 25,
              purchasePrice: 250,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Purchase created");

      // Verify inventory was updated
      const updatedInventory = await Inventory.findById(inventoryId).lean();
      const updatedCount = updatedInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(updatedCount).toBe(initialCount + 25);
    });
  });

  describe("Transaction Tests - DELETE /api/v1/purchases/:purchaseId", () => {
    it("deletes purchase and rolls back inventory count", async () => {
      const app = await getTestApp();

      // Create a purchase first
      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: `REC-DEL-${Date.now()}`,
        totalAmount: 150,
        purchaseInventoryItems: [
          {
            supplierGoodId,
            quantityPurchased: 15,
            purchasePrice: 150,
          },
        ],
      });

      // Manually increment inventory (simulating what POST would do)
      await Inventory.findOneAndUpdate(
        { _id: inventoryId, "inventoryGoods.supplierGoodId": supplierGoodId },
        { $inc: { "inventoryGoods.$.dynamicSystemCount": 15 } }
      );

      // Get count before delete
      const beforeDelete = await Inventory.findById(inventoryId).lean();
      const countBeforeDelete = beforeDelete?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/purchases/${purchase._id}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify purchase was deleted
      const deletedPurchase = await Purchase.findById(purchase._id);
      expect(deletedPurchase).toBeNull();

      // Verify inventory was rolled back
      const afterDelete = await Inventory.findById(inventoryId).lean();
      const countAfterDelete = afterDelete?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(countAfterDelete).toBe(countBeforeDelete - 15);
    });
  });

  describe("Transaction Tests - PATCH addSupplierGood", () => {
    it("adds supplierGood to purchase and updates inventory", async () => {
      const app = await getTestApp();

      // Create a purchase without items
      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: `REC-ADD-${Date.now()}`,
        totalAmount: 0,
        purchaseInventoryItems: [],
      });

      // Get initial inventory count
      const initialInventory = await Inventory.findById(inventoryId).lean();
      const initialCount = initialInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/addSupplierGood`,
        payload: {
          supplierGoodId: supplierGoodId.toString(),
          quantityPurchased: 20,
          purchasePrice: 200,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("added");

      // Verify inventory was updated
      const updatedInventory = await Inventory.findById(inventoryId).lean();
      const updatedCount = updatedInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(updatedCount).toBe(initialCount + 20);

      // Verify purchase was updated
      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.purchaseInventoryItems?.length).toBe(1);
      expect(updatedPurchase?.totalAmount).toBe(200);
    });
  });

  describe.sequential("Transaction Tests - PATCH editSupplierGood", () => {
    it("edits supplier good quantity and syncs inventory", async () => {
      const app = await getTestApp();

      // Create a manager user (employee needs userId reference)
      const managerUser = await User.create({
        personalDetails: {
          username: "editmanager",
          email: "editmanager@test.com",
          password: "hashedpassword123",
          firstName: "Edit",
          lastName: "Manager",
          phoneNumber: "9998887776",
          birthDate: new Date("1985-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "EDIT-MGR-001",
          address: validAddress,
        },
      });

      // Create manager employee with management role
      const managerEmployee = await Employee.create({
        businessId,
        userId: managerUser._id,
        currentShiftRole: "General Manager",
        joinDate: new Date(),
        taxNumber: `MGR-TAX-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      // Create purchase with an item
      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: managerEmployee._id,
        purchaseDate: new Date(),
        receiptId: "REC-001",
        totalAmount: 100,
        purchaseInventoryItems: [
          {
            supplierGoodId,
            quantityPurchased: 10,
            purchasePrice: 100,
          },
        ],
      });

      // Set initial inventory count
      await Inventory.findByIdAndUpdate(inventoryId, {
        $set: { "inventoryGoods.0.dynamicSystemCount": 50 },
      });

      const initialInventory = await Inventory.findById(inventoryId).lean();
      const initialCount = initialInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(initialCount).toBe(50);

      // Get the purchase item ID
      const purchaseDoc = await Purchase.findById(purchase._id).lean();
      const purchaseItemId = purchaseDoc?.purchaseInventoryItems?.[0]?._id;

      // Generate auth token for user (not business)
      const token = await generateTestToken({
        id: managerUser._id.toString(),
        email: "editmanager@test.com",
        type: "user",
        businessId: businessId.toString(),
        canLogAsEmployee: true,
      });

      // Edit: change quantity from 10 to 25 (difference: +15)
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/editSupplierGood`,
        headers: { authorization: token },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 25,
          newPurchasePrice: 250,
          reason: "Quantity correction",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated");

      // Verify inventory was updated: 50 - 10 (old) + 25 (new) = 65
      const updatedInventory = await Inventory.findById(inventoryId).lean();
      const updatedCount = updatedInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(updatedCount).toBe(65);

      // Verify purchase was updated
      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.purchaseInventoryItems?.[0]?.quantityPurchased).toBe(25);
      expect(updatedPurchase?.totalAmount).toBe(250);
    });
  });
});
