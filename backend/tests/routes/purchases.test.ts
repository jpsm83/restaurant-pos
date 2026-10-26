/**
 * Purchases Routes Tests - Phase 1 Module 10 + Phase 4 Task 4.1
 * Tests for purchases CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests with inventory updates (requires replica set)
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Purchase from "../../src/models/purchase.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Business from "../../src/models/business.ts";
import Employee from "../../src/models/employee.ts";
import User from "../../src/models/user.ts";
import Inventory from "../../src/models/inventory.ts";
import AuditEntry from "../../src/models/auditEntry.ts";
import {
  AUDIT_ACT_KINDS,
  AUDIT_ACTOR_KINDS,
  AUDIT_RETENTION_CLASSES,
  AUDIT_TARGET_KINDS,
} from "../../src/audit/auditCatalogue.ts";
import { multipart } from "../helpers/multipart.ts";
import {
  detail,
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

const appendAuditEntryMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/audit/appendAuditEntry.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/audit/appendAuditEntry.ts")>();
  appendAuditEntryMock.mockImplementation(actual.appendAuditEntry);
  return { ...actual, appendAuditEntry: appendAuditEntryMock };
});

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
    appendAuditEntryMock.mockClear();

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

    it("returns a problem-details 404 when no purchases exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("No purchases found");
    });

    it("returns a problem-details 400 for an invalid date range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases?startDate=2024-12-31&endDate=2024-01-01",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toContain("Invalid date range");
    });

    it("returns a validation problem for a malformed date", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases?startDate=not-a-date",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("startDate");
    });
  });

  describe("POST /api/v1/purchases", () => {
    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: { supplierId: supplierId.toString() },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toEqual(
        expect.arrayContaining([
          "purchaseDate",
          "businessId",
          "purchasedByEmployeeId",
          "receiptId",
          "purchaseInventoryItems",
        ]),
      );
    });

    it("returns a validation problem for an invalid businessId", async () => {
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
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });

    it("returns a problem-details 400 for one time purchase without comment", async () => {
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
            {
              supplierGoodId: supplierGoodId.toString(),
              quantityPurchased: 5,
              purchasePrice: 50,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toContain("Comment is required");
    });

    it("rejects unknown and server-owned fields", async () => {
      const app = await getTestApp();

      for (const field of ["totalAmount", "oneTimePurchase", "documentsUrl"]) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/purchases",
          payload: {
            supplierId: supplierId.toString(),
            purchaseDate: new Date().toISOString(),
            businessId: businessId.toString(),
            purchasedByEmployeeId: employeeId.toString(),
            receiptId: `REC-${field}`,
            purchaseInventoryItems: [],
            [field]: "x",
          },
        });

        expect(response.statusCode, `${field}: ${response.body}`).toBe(400);
        expect(isProblemDetails(response)).toBe(true);
      }
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

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("purchaseId");
    });

    it("returns a problem-details 404 for a non-existent purchase", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Purchase not found!");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId", () => {
    it("returns a validation problem for missing businessId", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}`,
        payload: multipart({ title: "Updated" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });

    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}`,
        payload: multipart({
          businessId: "invalid-id",
          purchasedByEmployeeId: employeeId.toString(),
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
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
        payload: multipart({
          businessId: businessId.toString(),
          purchasedByEmployeeId: employeeId.toString(),
          title: "Updated Title",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Purchase updated successfully!");

      const updated = await Purchase.findById(purchase._id).lean();
      expect(updated?.title).toBe("Updated Title");
    });

    it("accepts a JSON body as well as multipart", async () => {
      const app = await getTestApp();

      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-JSON",
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
          title: "Renamed",
        },
      });

      expect(response.statusCode, response.body).toBe(200);

      const updated = await Purchase.findById(purchase._id).lean();
      expect(updated?.title).toBe("Renamed");
    });

    it("returns a validation problem for an invalid businessId sent as JSON", async () => {
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
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });
  });

  describe("DELETE /api/v1/purchases/:purchaseId", () => {
    it("returns a validation problem for an invalid purchaseId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/purchases/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("purchaseId");
    });

    it("keeps a deleted purchase, hides it, and refuses a second delete", async () => {
      const app = await getTestApp();
      const receiptId = "REC-SOFT-DELETE";
      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId,
        totalAmount: 100,
        purchaseInventoryItems: [
          {
            supplierGoodId,
            quantityPurchased: 10,
            purchasePrice: 100,
          },
        ],
      });

      const removed = await app.inject({
        method: "DELETE",
        url: `/api/v1/purchases/${purchase._id}`,
      });
      expect(removed.statusCode).toBe(200);

      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/${purchase._id}`,
      });
      expect(hidden.statusCode).toBe(404);
      expect(isProblemDetails(hidden)).toBe(true);

      const listed = await app.inject({
        method: "GET",
        url: "/api/v1/purchases",
      });
      expect(listed.statusCode).toBe(404);

      const shown = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/${purchase._id}?includeDeleted=true`,
      });
      expect(shown.statusCode).toBe(200);
      expect(shown.headers["content-type"]).toContain("application/json");
      expect(shown.json()).toMatchObject({
        receiptId,
        deleted: true,
      });
      expect(shown.json().deletedAt).toBeTruthy();

      const listedDeleted = await app.inject({
        method: "GET",
        url: "/api/v1/purchases?includeDeleted=true",
      });
      expect(listedDeleted.statusCode).toBe(200);
      expect(listedDeleted.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ receiptId, deleted: true }),
        ]),
      );

      const again = await app.inject({
        method: "DELETE",
        url: `/api/v1/purchases/${purchase._id}`,
      });
      expect(again.statusCode).toBe(409);
      expect(isProblemDetails(again)).toBe(true);
      expect(detail(again)).toBe("Purchase already deleted!");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId/addSupplierGood", () => {
    it("returns a validation problem for an invalid supplierGoodId", async () => {
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
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierGoodId");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId/deleteSupplierGood", () => {
    it("returns a validation problem for an invalid purchaseId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/purchases/invalid-id/deleteSupplierGood",
        payload: { purchaseInventoryItemsId: new Types.ObjectId().toString() },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("purchaseId");
    });
  });

  describe("PATCH /api/v1/purchases/:purchaseId/editSupplierGood", () => {
    it("returns a problem-details 401 without authentication", async () => {
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
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Authentication required");
    });

    it("returns a validation problem for an invalid purchaseInventoryItemsId", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${fakeId}/editSupplierGood`,
        payload: {
          purchaseInventoryItemsId: "not-an-id",
          reason: "Correcting a line",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("purchaseInventoryItemsId");
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

    it("returns a validation problem for an invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases/supplier/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 404 when no purchases for supplier", async () => {
      const app = await getTestApp();
      const otherSupplierId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/supplier/${otherSupplierId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Purchase not found!");
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

    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/purchases/user/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns a problem-details 404 when no purchases for user", async () => {
      const app = await getTestApp();
      const otherUserId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/purchases/user/${otherUserId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Purchase not found!");
    });
  });

  // Phase 4 Task 4.1: Transaction Tests with Inventory Verification
  describe("Transaction Tests - POST /api/v1/purchases", () => {
    it("creates purchase and updates inventory count", async () => {
      const app = await getTestApp();

      // Get initial inventory count
      const initialInventory = await Inventory.findById(inventoryId).lean();
      const initialCount =
        initialInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;

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

      expect(response.statusCode, response.body).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Purchase created");

      // Verify inventory was updated
      const updatedInventory = await Inventory.findById(inventoryId).lean();
      const updatedCount =
        updatedInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(updatedCount).toBe(initialCount + 25);
    });

    it("adds received stock only on the active inventory", async () => {
      const app = await getTestApp();
      await Inventory.deleteMany({});
      const retired = await Inventory.create({
        businessId,
        setFinalCount: false,
        deleted: true,
        deletedAt: new Date(),
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 40,
            monthlyCounts: [],
          },
        ],
      });
      const activeInventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 100,
            monthlyCounts: [],
          },
        ],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: {
          supplierId: supplierId.toString(),
          purchaseDate: new Date().toISOString(),
          businessId: businessId.toString(),
          purchasedByEmployeeId: employeeId.toString(),
          receiptId: `REC-ACTIVE-ONLY-${Date.now()}`,
          purchaseInventoryItems: [
            {
              supplierGoodId: supplierGoodId.toString(),
              quantityPurchased: 25,
              purchasePrice: 250,
            },
          ],
        },
      });

      expect(response.statusCode, response.body).toBe(201);

      const active = await Inventory.findById(activeInventory._id).lean();
      const deleted = await Inventory.findById(retired._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(active?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(125);
      expect(deleted?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(40);
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
        { $inc: { "inventoryGoods.$.dynamicSystemCount": 15 } },
      );

      // Get count before delete
      const beforeDelete = await Inventory.findById(inventoryId).lean();
      const countBeforeDelete =
        beforeDelete?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/purchases/${purchase._id}`,
      });

      expect(response.statusCode).toBe(200);

      const deletedPurchase = await Purchase.findById(purchase._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(deletedPurchase).not.toBeNull();
      expect(deletedPurchase?.deleted).toBe(true);

      // Verify inventory was rolled back
      const afterDelete = await Inventory.findById(inventoryId).lean();
      const countAfterDelete =
        afterDelete?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(countAfterDelete).toBe(countBeforeDelete - 15);
    });

    it("removes stock only from the active inventory when a purchase is deleted", async () => {
      const app = await getTestApp();
      await Inventory.deleteMany({});
      const retired = await Inventory.create({
        businessId,
        setFinalCount: false,
        deleted: true,
        deletedAt: new Date(),
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 40,
            monthlyCounts: [],
          },
        ],
      });
      const activeInventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 100,
            monthlyCounts: [],
          },
        ],
      });
      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: `REC-DEL-ACTIVE-${Date.now()}`,
        totalAmount: 150,
        purchaseInventoryItems: [
          {
            supplierGoodId,
            quantityPurchased: 15,
            purchasePrice: 150,
          },
        ],
      });
      await Inventory.findOneAndUpdate(
        { _id: activeInventory._id, "inventoryGoods.supplierGoodId": supplierGoodId },
        { $inc: { "inventoryGoods.$.dynamicSystemCount": 15 } },
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/purchases/${purchase._id}`,
      });

      expect(response.statusCode, response.body).toBe(200);

      const active = await Inventory.findById(activeInventory._id).lean();
      const deleted = await Inventory.findById(retired._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(active?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(100);
      expect(deleted?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(40);
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
      const initialCount =
        initialInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/addSupplierGood`,
        payload: {
          supplierGoodId: supplierGoodId.toString(),
          quantityPurchased: 20,
          purchasePrice: 200,
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("added");

      // Verify inventory was updated
      const updatedInventory = await Inventory.findById(inventoryId).lean();
      const updatedCount =
        updatedInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(updatedCount).toBe(initialCount + 20);

      // Verify purchase was updated
      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.purchaseInventoryItems?.length).toBe(1);
      expect(updatedPurchase?.totalAmount).toBe(200);
    });
  });

  describe("Transaction Tests - PATCH editSupplierGood", () => {
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
      const initialCount =
        initialInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
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
        role: "Manager",
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

      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated");

      // Verify inventory was updated: 50 - 10 (old) + 25 (new) = 65
      const updatedInventory = await Inventory.findById(inventoryId).lean();
      const updatedCount =
        updatedInventory?.inventoryGoods?.[0]?.dynamicSystemCount ?? 0;
      expect(updatedCount).toBe(65);

      // Verify purchase was updated
      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.purchaseInventoryItems?.[0]?.quantityPurchased).toBe(
        25,
      );
      expect(updatedPurchase?.totalAmount).toBe(250);
    });
  });

  describe("Audit rail - PATCH /api/v1/purchases/:purchaseId/editSupplierGood", () => {
    const seedEditFixture = async () => {
      const purchase = await Purchase.create({
        businessId,
        supplierId,
        purchasedByEmployeeId: employeeId,
        purchaseDate: new Date(),
        receiptId: "REC-AUDIT-001",
        totalAmount: 100,
        purchaseInventoryItems: [
          {
            supplierGoodId,
            quantityPurchased: 10,
            purchasePrice: 100,
            lastEditByEmployeeId: employeeId,
            lastEditReason: "Initial correction",
            lastEditDate: new Date("2026-01-01"),
            lastEditOriginalQuantity: 8,
            lastEditOriginalPrice: 80,
          },
        ],
      });

      await Inventory.findByIdAndUpdate(inventoryId, {
        $set: { "inventoryGoods.0.dynamicSystemCount": 50 },
      });

      const authorization = await generateTestToken({
        id: userId.toString(),
        email: "purchaseuser@test.com",
        type: "user",
        employeeId: employeeId.toString(),
        businessId: businessId.toString(),
        canLogAsEmployee: true,
        role: "Manager",
      });

      return {
        purchase,
        purchaseItemId: purchase.purchaseInventoryItems?.[0]._id,
        authorization,
      };
    };

    const storedLine = async (purchaseId: Types.ObjectId) => {
      const purchase = await Purchase.findById(purchaseId).lean();
      return purchase?.purchaseInventoryItems?.[0];
    };

    it("appends one entry on the edit transaction with the actor, targets, and before/after values", async () => {
      const app = await getTestApp();
      const { purchase, purchaseItemId, authorization } =
        await seedEditFixture();
      const reason = "Receipt quantity was misread";

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/editSupplierGood`,
        headers: { authorization },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 25,
          newPurchasePrice: 250,
          reason,
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({
        message: "Supplier good line updated successfully!",
      });

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry.actorKind).toBe(AUDIT_ACTOR_KINDS.USER);
      expect(String(entry.actorId)).toBe(String(userId));
      expect(String(entry.actorId)).not.toBe(String(employeeId));
      expect(entry.actKind).toBe(AUDIT_ACT_KINDS.PURCHASE_LINE_EDITED);
      expect(entry.target).toEqual({
        kind: AUDIT_TARGET_KINDS.PURCHASE,
        id: purchase._id,
      });
      expect(entry.relatedTargets).toEqual(
        expect.arrayContaining([
          {
            kind: AUDIT_TARGET_KINDS.PURCHASE_LINE,
            id: purchaseItemId,
          },
          {
            kind: AUDIT_TARGET_KINDS.SUPPLIER_GOOD,
            id: supplierGoodId,
          },
        ]),
      );
      expect(String(entry.businessId)).toBe(String(businessId));
      expect(entry.payload).toEqual({
        quantityBefore: 10,
        quantityAfter: 25,
        priceBefore: 100,
        priceAfter: 250,
        reason,
      });
      expect(entry.retentionClass).toBe(
        AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
      );
      expect(entry.impersonation).toBe(false);

      expect(appendAuditEntryMock).toHaveBeenCalledTimes(1);
      expect(appendAuditEntryMock.mock.calls[0][0].session).toBeDefined();

      const line = await storedLine(purchase._id);
      expect(line?.quantityPurchased).toBe(25);
      expect(line?.purchasePrice).toBe(250);
      expect(line?.lastEditReason).toBe(reason);
      expect(String(line?.lastEditByEmployeeId)).toBe(String(employeeId));
      expect(line?.lastEditOriginalQuantity).toBe(10);
      expect(line?.lastEditOriginalPrice).toBe(100);
      expect(line?.lastEditDate?.getTime()).toBeGreaterThan(
        new Date("2026-01-01").getTime(),
      );

      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.totalAmount).toBe(250);

      const inventory = await Inventory.findById(inventoryId).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(65);
    });

    it("appends one entry for a price-only change and leaves the stock unchanged", async () => {
      const app = await getTestApp();
      const { purchase, purchaseItemId, authorization } =
        await seedEditFixture();
      const reason = "Receipt price was misread";

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/editSupplierGood`,
        headers: { authorization },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 10,
          newPurchasePrice: 150,
          reason,
        },
      });

      expect(response.statusCode, response.body).toBe(200);

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(1);
      expect(entries[0].payload).toEqual({
        quantityBefore: 10,
        quantityAfter: 10,
        priceBefore: 100,
        priceAfter: 150,
        reason,
      });

      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.totalAmount).toBe(150);

      const inventory = await Inventory.findById(inventoryId).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(50);
    });

    it("appends a second entry and leaves the first unchanged", async () => {
      const app = await getTestApp();
      const { purchase, purchaseItemId, authorization } =
        await seedEditFixture();
      const url = `/api/v1/purchases/${purchase._id}/editSupplierGood`;

      const first = await app.inject({
        method: "PATCH",
        url,
        headers: { authorization },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 25,
          newPurchasePrice: 250,
          reason: "First correction",
        },
      });
      const second = await app.inject({
        method: "PATCH",
        url,
        headers: { authorization },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 30,
          newPurchasePrice: 300,
          reason: "Second correction",
        },
      });

      expect(first.statusCode, first.body).toBe(200);
      expect(second.statusCode, second.body).toBe(200);

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(2);
      expect(
        entries.map((entry) => entry.payload).sort((a, b) => {
          const left = (a as { quantityBefore: number }).quantityBefore;
          const right = (b as { quantityBefore: number }).quantityBefore;
          return left - right;
        }),
      ).toEqual([
        {
          quantityBefore: 10,
          quantityAfter: 25,
          priceBefore: 100,
          priceAfter: 250,
          reason: "First correction",
        },
        {
          quantityBefore: 25,
          quantityAfter: 30,
          priceBefore: 250,
          priceAfter: 300,
          reason: "Second correction",
        },
      ]);

      const line = await storedLine(purchase._id);
      expect(line?.quantityPurchased).toBe(30);
      expect(line?.purchasePrice).toBe(300);
      expect(line?.lastEditReason).toBe("Second correction");
      expect(line?.lastEditOriginalQuantity).toBe(25);
      expect(line?.lastEditOriginalPrice).toBe(250);

      const inventory = await Inventory.findById(inventoryId).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(70);
    });

    it("appends nothing and keeps the latest-edit snapshot when quantity and price stay the same", async () => {
      const app = await getTestApp();
      const { purchase, purchaseItemId, authorization } =
        await seedEditFixture();
      const initialLine = purchase.purchaseInventoryItems?.[0];

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/editSupplierGood`,
        headers: { authorization },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 10,
          newPurchasePrice: 100,
          reason: "No change",
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({
        message: "Supplier good line updated successfully!",
      });
      expect(await AuditEntry.countDocuments()).toBe(0);
      expect(appendAuditEntryMock).not.toHaveBeenCalled();

      const line = await storedLine(purchase._id);
      expect(line?.quantityPurchased).toBe(10);
      expect(line?.purchasePrice).toBe(100);
      expect(line?.lastEditReason).toBe("Initial correction");
      expect(line?.lastEditOriginalQuantity).toBe(8);
      expect(line?.lastEditOriginalPrice).toBe(80);
      expect(line?.lastEditDate?.toISOString()).toBe(
        initialLine?.lastEditDate?.toISOString(),
      );
      expect(String(line?.lastEditByEmployeeId)).toBe(
        String(initialLine?.lastEditByEmployeeId),
      );

      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.totalAmount).toBe(100);

      const inventory = await Inventory.findById(inventoryId).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(50);
    });

    it("rolls back the edit and surfaces the route's server error when the append fails", async () => {
      const app = await getTestApp();
      const { purchase, purchaseItemId, authorization } =
        await seedEditFixture();
      const initialLine = purchase.purchaseInventoryItems?.[0];
      appendAuditEntryMock.mockResolvedValueOnce({
        success: false,
        error: "audit unavailable",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/purchases/${purchase._id}/editSupplierGood`,
        headers: { authorization },
        payload: {
          purchaseInventoryItemsId: purchaseItemId?.toString(),
          newQuantityPurchased: 25,
          newPurchasePrice: 250,
          reason: "Should not commit",
        },
      });

      expect(response.statusCode, response.body).toBe(500);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).type).toBe(
        "https://restaurant-pos.app/errors/internal",
      );
      expect(await AuditEntry.countDocuments()).toBe(0);

      const line = await storedLine(purchase._id);
      expect(line?.quantityPurchased).toBe(10);
      expect(line?.purchasePrice).toBe(100);
      expect(line?.lastEditReason).toBe("Initial correction");
      expect(line?.lastEditOriginalQuantity).toBe(8);
      expect(line?.lastEditOriginalPrice).toBe(80);
      expect(line?.lastEditDate?.toISOString()).toBe(
        initialLine?.lastEditDate?.toISOString(),
      );
      expect(String(line?.lastEditByEmployeeId)).toBe(
        String(initialLine?.lastEditByEmployeeId),
      );

      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      expect(updatedPurchase?.totalAmount).toBe(100);

      const inventory = await Inventory.findById(inventoryId).lean();
      expect(inventory?.inventoryGoods?.[0]?.dynamicSystemCount).toBe(50);
    });
  });
});
