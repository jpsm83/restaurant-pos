/**
 * Purchases Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import Purchase from "../../src/models/purchase.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import Employee from "../../src/models/employee.ts";
import User from "../../src/models/user.ts";
import Inventory from "../../src/models/inventory.ts";
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

    const business = await createTestBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
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
    await Inventory.create({
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/purchases",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("No purchases found");
    });

    it("returns a problem-details 400 for an invalid date range", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/purchases?startDate=2024-12-31&endDate=2024-01-01",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toContain("Invalid date range");
    });

    it("returns a validation problem for a malformed date", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/purchases?startDate=not-a-date",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("startDate");
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/purchases/${purchase._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(purchase._id.toString());
    });

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/purchases/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Purchase not found!");
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/purchases/user/${otherUserId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Purchase not found!");
    });
  });

});
