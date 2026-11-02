/**
 * SupplierGoods Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Supplier from "../../src/models/supplier.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import {
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

describe("SupplierGoods Routes", () => {
  let businessId: Types.ObjectId;
  let supplierId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

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
  });

  describe("GET /api/v1/supplierGoods", () => {
    it("lists all supplier goods", async () => {
      const app = await getTestApp();

      await SupplierGood.create({
        businessId,
        supplierId,
        name: "Tomatoes",
        keyword: "tomato",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/supplierGoods",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe("Tomatoes");
    });

    it("returns a problem-details 404 when no supplier goods exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/supplierGoods",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No supplier goods found!");
    });

    it("returns a problem-details 400 for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/supplierGoods?includeDeleted=maybe",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("includeDeleted");
    });
  });


  describe("GET /api/v1/supplierGoods/:supplierGoodId", () => {
    it("gets supplier good by ID", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Onions",
        keyword: "onion",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Onions");
    });

    it("returns a problem-details 400 for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/supplierGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierGoodId");
    });

    it("returns a problem-details 404 for a non-existent supplier good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/supplierGoods/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("Supplier good not found!");
    });
  });



  describe("GET /api/v1/supplierGoods/supplier/:supplierId", () => {
    it("lists supplier goods by supplier", async () => {
      const app = await getTestApp();

      await SupplierGood.create({
        businessId,
        supplierId,
        name: "Carrots",
        keyword: "carrot",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/supplierGoods/supplier/${supplierId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns a problem-details 400 for an invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/supplierGoods/supplier/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 404 when no supplier goods exist for a supplier", async () => {
      const app = await getTestApp();
      const otherSupplierId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/supplierGoods/supplier/${otherSupplierId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No supplier goods found!");
    });
  });

});
