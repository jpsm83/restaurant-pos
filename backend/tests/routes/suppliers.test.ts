/**
 * Suppliers Routes Tests - Phase 1 Module 7
 * Tests for suppliers CRUD endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import Supplier from "../../src/models/supplier.js";
import Business from "../../src/models/business.js";

describe("Suppliers Routes", () => {
  let businessId: Types.ObjectId;

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
  });

  describe("GET /api/v1/suppliers", () => {
    it("lists all suppliers", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Supplier A",
        legalName: "Supplier A LLC",
        email: "suppliera@test.com",
        phoneNumber: "1111111111",
        taxNumber: "SUP-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Supplier A");
    });

    it("returns 404 when no suppliers exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No suppliers found!");
    });
  });

  describe("POST /api/v1/suppliers", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("tradeName", "Test Supplier");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("tradeName", "Test Supplier");
      form.append("legalName", "Test Supplier LLC");
      form.append("email", "test@supplier.com");
      form.append("phoneNumber", "9999999999");
      form.append("taxNumber", "TAX-999");
      form.append("currentlyInUse", "true");
      form.append("address", JSON.stringify(validAddress));
      form.append("businessId", "invalid-id");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business ID is not valid!");
    });

    it("returns 400 for invalid email format", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("tradeName", "Test Supplier");
      form.append("legalName", "Test Supplier LLC");
      form.append("email", "invalid-email");
      form.append("phoneNumber", "9999999999");
      form.append("taxNumber", "TAX-999");
      form.append("currentlyInUse", "true");
      form.append("address", JSON.stringify(validAddress));
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid email format!");
    });

    it("returns 400 for reserved 'One Time Purchase' values", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("tradeName", "One Time Purchase");
      form.append("legalName", "Test Supplier LLC");
      form.append("email", "test@supplier.com");
      form.append("phoneNumber", "9999999999");
      form.append("taxNumber", "TAX-999");
      form.append("currentlyInUse", "true");
      form.append("address", JSON.stringify(validAddress));
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("One Time Purchase");
    });

    it("returns 409 for duplicate supplier", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Existing Supplier",
        legalName: "Existing Supplier LLC",
        email: "existing@supplier.com",
        phoneNumber: "8888888888",
        taxNumber: "EXIST-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const form = new FormData();
      form.append("tradeName", "New Supplier");
      form.append("legalName", "Existing Supplier LLC");
      form.append("email", "new@supplier.com");
      form.append("phoneNumber", "7777777777");
      form.append("taxNumber", "NEW-001");
      form.append("currentlyInUse", "true");
      form.append("address", JSON.stringify(validAddress));
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
    });
  });

  describe("GET /api/v1/suppliers/:supplierId", () => {
    it("gets supplier by ID", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Supplier B",
        legalName: "Supplier B LLC",
        email: "supplierb@test.com",
        phoneNumber: "2222222222",
        taxNumber: "SUP-002",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tradeName).toBe("Supplier B");
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplier ID!");
    });

    it("returns 404 for non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No suppliers found!");
    });
  });

  describe("PATCH /api/v1/suppliers/:supplierId", () => {
    it("returns 400 for invalid supplierId", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("tradeName", "Updated Name");

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/suppliers/invalid-id",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplier ID!");
    });

    it("returns 400 for missing required fields on update", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Original Supplier",
        legalName: "Original Supplier LLC",
        email: "original@supplier.com",
        phoneNumber: "3333333333",
        taxNumber: "ORIG-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const form = new FormData();
      form.append("tradeName", "Updated Name");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${supplier._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 404 for non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const form = new FormData();
      form.append("tradeName", "Updated Name");
      form.append("legalName", "Updated LLC");
      form.append("email", "updated@supplier.com");
      form.append("phoneNumber", "4444444444");
      form.append("taxNumber", "UPD-001");
      form.append("currentlyInUse", "true");
      form.append("address", JSON.stringify(validAddress));

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${fakeId}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Supplier not found!");
    });

    it("updates supplier successfully", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Original Supplier",
        legalName: "Original Supplier LLC",
        email: "original@supplier.com",
        phoneNumber: "3333333333",
        taxNumber: "ORIG-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const form = new FormData();
      form.append("tradeName", "Updated Supplier");
      form.append("legalName", "Original Supplier LLC");
      form.append("email", "original@supplier.com");
      form.append("phoneNumber", "3333333333");
      form.append("taxNumber", "ORIG-001");
      form.append("currentlyInUse", "true");
      form.append("address", JSON.stringify(validAddress));

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${supplier._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Supplier updated successfully!");

      const updated = await Supplier.findById(supplier._id);
      expect(updated?.tradeName).toBe("Updated Supplier");
    });
  });

  describe("DELETE /api/v1/suppliers/:supplierId", () => {
    it("returns 400 for invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/suppliers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplier ID!");
    });

    it("returns 404 for non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business good not found!");
    });
  });

  describe("GET /api/v1/suppliers/business/:businessId", () => {
    it("lists suppliers by business", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Supplier C",
        legalName: "Supplier C LLC",
        email: "supplierc@test.com",
        phoneNumber: "5555555555",
        taxNumber: "SUP-003",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/business/${businessId}`,
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
        url: "/api/v1/suppliers/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 404 when no suppliers for business", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/business/${otherBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No suppliers found!");
    });
  });
});
