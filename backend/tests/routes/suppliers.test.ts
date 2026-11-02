/**
 * Suppliers Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { Types } from "mongoose";
import { getTestApp, resetTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import Supplier from "../../src/models/supplier.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import {
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

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

  beforeAll(async () => {
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  beforeEach(async () => {
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
  });

  describe("GET /api/v1/suppliers", () => {
    it("lists only active suppliers by default", async () => {
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
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "9990009999",
        taxNumber: "SUP-DEL-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/suppliers",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Supplier A");
    });

    it("includes deleted suppliers when includeDeleted=true", async () => {
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
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "9990009999",
        taxNumber: "SUP-DEL-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/suppliers?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((supplier: { deleted?: boolean }) => supplier.deleted)).toBe(
        true,
      );
    });

    it("returns a problem-details 404 when no suppliers exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/suppliers",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });

    it("returns a problem-details 400 for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/suppliers?includeDeleted=maybe",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("includeDeleted");
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tradeName).toBe("Supplier B");
    });

    it("returns a problem-details 400 for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/suppliers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 404 for a non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });

    it("returns a problem-details 404 for a soft-deleted supplier by default", async () => {
      const app = await getTestApp();
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Soft Deleted Supplier",
        legalName: "Soft Deleted Supplier LLC",
        email: "softdeleted@supplier.com",
        phoneNumber: "1111112222",
        taxNumber: "SUP-SOFT-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });

    it("returns a soft-deleted supplier when includeDeleted=true", async () => {
      const app = await getTestApp();
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Soft Deleted Supplier",
        legalName: "Soft Deleted Supplier LLC",
        email: "softdeleted@supplier.com",
        phoneNumber: "1111112222",
        taxNumber: "SUP-SOFT-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toBe(true);
    });
  });



  describe("GET /api/v1/suppliers/business/:businessId", () => {
    it("lists active suppliers by business by default", async () => {
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
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "0000011111",
        taxNumber: "SUP-DEL-003",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists deleted suppliers by business when includeDeleted=true", async () => {
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
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "0000011111",
        taxNumber: "SUP-DEL-003",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/business/${businessId}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns a problem-details 400 for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/suppliers/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });

    it("returns a problem-details 404 when the business has no suppliers", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/suppliers/business/${otherBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });
  });
});
