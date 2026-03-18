/**
 * Promotions Routes Tests - Phase 1 Module 14
 * Tests for promotions CRUD endpoints
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import Promotion from "../../src/models/promotion.js";
import Business from "../../src/models/business.js";

describe("Promotions Routes", () => {
  const createTestBusiness = async () => {
    return await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: {
        country: "USA",
        state: "CA",
        city: "Los Angeles",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });
  };

  const createTestPromotion = async (businessId: Types.ObjectId, name: string) => {
    return await Promotion.create({
      promotionName: name,
      businessId,
      promotionPeriod: {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
      },
      weekDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      activePromotion: true,
      promotionType: {
        fixedPrice: 9.99,
      },
    });
  };

  describe("GET /api/v1/promotions", () => {
    it("lists all promotions", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(business._id as Types.ObjectId, "Test Promo");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 404 when no promotions exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No promotion");
    });
  });

  describe("POST /api/v1/promotions", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: { promotionName: "Test" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid businessGoodsToApplyIds (not array)", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          promotionName: "Test Promo",
          businessId: business._id,
          promotionPeriod: {
            start: "2024-01-01",
            end: "2024-12-31",
          },
          weekDays: ["Monday", "Tuesday", "Wednesday"],
          activePromotion: true,
          promotionType: {
            fixedPrice: 9.99,
          },
          businessGoodsToApplyIds: "not-an-array",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("array");
    });

    it("returns 400 for invalid businessGoodsToApplyIds (invalid ObjectId)", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          promotionName: "Test Promo",
          businessId: business._id,
          promotionPeriod: {
            start: "2024-01-01",
            end: "2024-12-31",
          },
          weekDays: ["Monday", "Tuesday", "Wednesday"],
          activePromotion: true,
          promotionType: {
            fixedPrice: 9.99,
          },
          businessGoodsToApplyIds: ["invalid-id"],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("IDs not valid");
    });

    it("returns 400 for invalid promotionType", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          promotionName: "Test Promo",
          businessId: business._id,
          promotionPeriod: {
            start: "2024-01-01",
            end: "2024-12-31",
          },
          weekDays: ["Monday", "Tuesday", "Wednesday"],
          activePromotion: true,
          promotionType: {},
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for duplicate promotion name", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(business._id as Types.ObjectId, "Duplicate Promo");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          promotionName: "Duplicate Promo",
          businessId: business._id,
          promotionPeriod: {
            start: "2024-01-01",
            end: "2024-12-31",
          },
          weekDays: ["Monday", "Tuesday", "Wednesday"],
          activePromotion: true,
          promotionType: {
            fixedPrice: 9.99,
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
    });

    it("creates promotion successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          promotionName: "New Promo",
          businessId: business._id,
          promotionPeriod: {
            start: "2024-01-01",
            end: "2024-12-31",
          },
          weekDays: ["Monday", "Tuesday", "Wednesday"],
          activePromotion: true,
          promotionType: {
            fixedPrice: 9.99,
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created successfully");
    });
  });

  describe("GET /api/v1/promotions/:promotionId", () => {
    it("returns 400 for invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid promotionId!");
    });

    it("returns 404 for non-existent promotion", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
    });

    it("gets promotion by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(business._id as Types.ObjectId, "Get Promo");

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/${promotion._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(promotion._id.toString());
    });
  });

  describe("PATCH /api/v1/promotions/:promotionId", () => {
    it("returns 400 for invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/promotions/invalid-id",
        payload: { promotionName: "Updated" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid promotionId!");
    });

    it("returns 404 for non-existent promotion", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/promotions/${fakeId}`,
        payload: { promotionName: "Updated" },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Promotion not found!");
    });

    it("returns 400 for invalid businessGoodsToApplyIds", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(business._id as Types.ObjectId, "Patch Promo");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/promotions/${promotion._id}`,
        payload: { businessGoodsToApplyIds: ["invalid-id"] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("IDs not valid");
    });

    it("updates promotion successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(business._id as Types.ObjectId, "Update Promo");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/promotions/${promotion._id}`,
        payload: { promotionName: "Updated Promo Name" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated successfully");
    });
  });

  describe("DELETE /api/v1/promotions/:promotionId", () => {
    it("returns 400 for invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/promotions/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid promotionId!");
    });

    it("returns 404 for non-existent promotion", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/promotions/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Promotion not found!");
    });

    it("deletes promotion successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(business._id as Types.ObjectId, "Delete Promo");

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/promotions/${promotion._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("deleted");
    });
  });

  describe("GET /api/v1/promotions/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 404 when no promotions for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No promotion");
    });

    it("returns 400 for invalid date range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${business._id}?startDate=2024-12-31&endDate=2024-01-01`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid date range");
    });

    it("lists promotions by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(business._id as Types.ObjectId, "Business Promo");

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
