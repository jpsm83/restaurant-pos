/**
 * Promotions Routes Tests - Phase 1 Module 14
 * Tests for promotions CRUD endpoints
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import Promotion from "../../src/models/promotion.ts";
import Business from "../../src/models/business.ts";

describe("Promotions Routes", () => {
  const createTestBusiness = async () => {
    return await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
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

  const createTestPromotion = async (
    businessId: Types.ObjectId,
    name: string,
    opts?: { deleted?: boolean },
  ) => {
    return await Promotion.create({
      promotionName: name,
      businessId,
      promotionPeriod: {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
      },
      weekDays: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      activePromotion: true,
      promotionType: {
        fixedPrice: 9.99,
      },
      deleted: opts?.deleted,
      deletedAt: opts?.deleted ? new Date() : undefined,
    });
  };

  const validPromotionPayload = (businessId: Types.ObjectId) => ({
    promotionName: "Test Promo",
    businessId: businessId.toString(),
    promotionPeriod: {
      start: "2024-01-01",
      end: "2024-12-31",
    },
    weekDays: ["Monday", "Tuesday", "Wednesday"],
    activePromotion: true,
    promotionType: {
      fixedPrice: 9.99,
    },
  });

  const expectProblem = (
    response: {
      statusCode: number;
      headers: Record<string, unknown>;
      json: () => any;
    },
    status: number,
    typeSlug: string,
  ) => {
    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    const body = response.json();
    expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
    expect(body.status).toBe(status);
    return body;
  };

  describe("GET /api/v1/promotions", () => {
    it("lists all promotions", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(business._id as Types.ObjectId, "Test Promo");
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Deleted Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("includes soft-deleted promotions when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(business._id as Types.ObjectId, "Test Promo");
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Deleted Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns a not-found problem when no promotions exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No promotions found!");
    });
  });

  describe("POST /api/v1/promotions", () => {
    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: { promotionName: "Test" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "promotionPeriod" }),
          expect.objectContaining({ path: "weekDays" }),
          expect.objectContaining({ path: "activePromotion" }),
          expect.objectContaining({ path: "promotionType" }),
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for invalid businessGoodsToApplyIds (not array)", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          businessGoodsToApplyIds: "not-an-array",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessGoodsToApplyIds" }),
        ]),
      );
    });

    it("returns a validation problem for invalid businessGoodsToApplyIds (invalid ObjectId)", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          businessGoodsToApplyIds: ["invalid-id"],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessGoodsToApplyIds.0" }),
        ]),
      );
    });

    it("returns a bad-request problem for an empty promotionType", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          promotionType: {},
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Promotion type must have only one key and one value!",
      );
    });

    it("returns a bad-request problem for a promotionType with two pricing keys", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          promotionType: { fixedPrice: 9.99, discountPercent: 10 },
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Promotion type must have only one key and one value!",
      );
    });

    it("returns a bad-request problem when the promotion period start is not before end", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          promotionPeriod: { start: "2024-12-31", end: "2024-01-01" },
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe("The start date must be before the end date.");
    });

    it("returns a bad-request problem for an empty weekDays array", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          weekDays: [],
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "WeekDaysis required and must be an array of days of the week!",
      );
    });

    it("returns a validation problem for an invalid week day", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          weekDays: ["Funday"],
        },
      });

      expectProblem(response, 400, "validation");
    });

    it("rejects an unknown key", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          isAdmin: true,
        },
      });

      expectProblem(response, 400, "validation");
    });

    it("returns a conflict problem for a duplicate promotion name", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Duplicate Promo",
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          promotionName: "Duplicate Promo",
        },
      });

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("Promotion Duplicate Promo already exists!");
    });

    it("creates promotion successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/promotions",
        payload: {
          ...validPromotionPayload(business._id as Types.ObjectId),
          promotionName: "New Promo",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created successfully");
    });
  });

  describe("GET /api/v1/promotions/:promotionId", () => {
    it("returns a validation problem for an invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "promotionId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent promotion", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Promotion not found!");
    });

    it("gets promotion by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Get Promo",
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/${promotion._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(promotion._id.toString());
    });

    it("returns not-found for soft-deleted promotion by default", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Soft Deleted Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/${promotion._id}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Promotion not found!");
    });

    it("returns soft-deleted promotion when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Soft Deleted Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/${promotion._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });
  });

  describe("PATCH /api/v1/promotions/:promotionId", () => {
    it("returns a validation problem for an invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/promotions/invalid-id",
        payload: { promotionName: "Updated" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "promotionId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent promotion", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/promotions/${fakeId}`,
        payload: { promotionName: "Updated" },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Promotion not found!");
    });

    it("returns a validation problem for invalid businessGoodsToApplyIds", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Patch Promo",
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/promotions/${promotion._id}`,
        payload: { businessGoodsToApplyIds: ["invalid-id"] },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessGoodsToApplyIds.0" }),
        ]),
      );
    });

    it("returns a conflict problem for a duplicate promotion name", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(business._id as Types.ObjectId, "Taken");
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Rename Me",
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/promotions/${promotion._id}`,
        payload: { promotionName: "Taken" },
      });

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("Promotion Taken already exists!");
    });

    it("updates promotion successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Update Promo",
      );

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
    it("returns a validation problem for an invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/promotions/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "promotionId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent promotion", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/promotions/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Promotion not found!");
    });

    it("deletes promotion successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Delete Promo",
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/promotions/${promotion._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("deleted");

      const persisted = await Promotion.findById(promotion._id).lean();
      expect(persisted).not.toBeNull();
      expect(persisted?.deleted).toBe(true);
    });

    it("returns conflict when promotion already soft-deleted", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const promotion = await createTestPromotion(
        business._id as Types.ObjectId,
        "Already Deleted Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/promotions/${promotion._id}`,
      });

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("Promotion already deleted!");
    });
  });

  describe("GET /api/v1/promotions/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/promotions/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a not-found problem when no promotions exist for the business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No promotion found!");
    });

    it("returns a bad-request problem for an invalid date range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${business._id}?startDate=2024-12-31&endDate=2024-01-01`,
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Invalid date range, start date must be before end date!",
      );
    });

    it("lists promotions by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Business Promo",
      );
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Deleted Business Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists deleted promotions by business when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Business Promo",
      );
      await createTestPromotion(
        business._id as Types.ObjectId,
        "Deleted Business Promo",
        { deleted: true },
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/promotions/business/${business._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });
  });
});
