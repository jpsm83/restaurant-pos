/**
 * BusinessGoods Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import { isProblemDetails } from "../helpers/problemDetails.ts";

describe("BusinessGoods Routes", () => {
  let businessId: Types.ObjectId;

  beforeEach(async () => {
    const business = await createTestBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });
    businessId = business._id;
  });

  describe("GET /api/v1/businessGoods", () => {
    it("lists all business goods", async () => {
      const app = await getTestApp();

      await BusinessGood.create({
        businessId,
        name: "Burger",
        keyword: "burger",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 12.99,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/businessGoods",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe("Burger");
    });

    it("returns 404 when no business goods exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/businessGoods",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No businessId goods found!");
    });

    it("returns a problem-details 400 for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/businessGoods?includeDeleted=maybe",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("includeDeleted");
    });
  });

  describe("GET /api/v1/businessGoods/:businessGoodId", () => {
    it("gets business good by ID", async () => {
      const app = await getTestApp();

      const businessGood = await BusinessGood.create({
        businessId,
        name: "Pizza",
        keyword: "pizza",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 15.99,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/businessGoods/${businessGood._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Pizza");
    });

    it("returns a problem-details 400 for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/businessGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      const body = JSON.parse(response.body);
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors[0].path).toBe("businessGoodId");
    });

    it("returns 404 for non-existent business good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/businessGoods/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
    });
  });




  describe("GET /api/v1/businessGoods/business/:businessId", () => {
    it("lists business goods by business", async () => {
      const app = await getTestApp();

      await BusinessGood.create([
        {
          businessId,
          name: "Item 1",
          keyword: "item1",
          mainCategory: "Food",
          onMenu: true,
          available: true,
          sellingPrice: 10.0,
        },
        {
          businessId,
          name: "Item 2",
          keyword: "item2",
          mainCategory: "Beverage",
          onMenu: true,
          available: true,
          sellingPrice: 5.0,
        },
      ]);

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/businessGoods/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns a problem-details 400 for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/businessGoods/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("businessId");
    });

    it("returns 404 when business has no goods", async () => {
      const app = await getTestApp();
      const emptyBusinessId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/businessGoods/business/${emptyBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

});
