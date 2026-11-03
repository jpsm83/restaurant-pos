/**
 * Promotions Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import Promotion from "../../src/models/promotion.ts";
import { createTestBusiness as createCompanyAwareBusiness } from "../helpers/fixtures.ts";

describe("Promotions Routes", () => {
  const createTestBusiness = async () => {
    return await createCompanyAwareBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
      currencyTrade: "USD",
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/promotions?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns a not-found problem when no promotions exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/promotions",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No promotions found!");
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/promotions?includeDeleted=maybe",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "includeDeleted" }),
        ]),
      );
    });
  });


  describe("GET /api/v1/promotions/:promotionId", () => {
    it("returns a validation problem for an invalid promotionId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/promotions/${promotion._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });
  });



  describe("GET /api/v1/promotions/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/promotions/business/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No promotion found!");
    });

    it("returns a bad-request problem for an invalid date range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/promotions/business/${business._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });
  });
});
