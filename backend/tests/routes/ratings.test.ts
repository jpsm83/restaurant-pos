/**
 * Ratings Routes Tests - Phase 1 Module 19
 * Tests for ratings endpoints
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Rating from "../../src/models/rating.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";

describe("Ratings Routes", () => {
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

  const createTestUser = async () => {
    return await User.create({
      personalDetails: {
        username: `user${Date.now()}`,
        email: `user${Date.now()}@test.com`,
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        idType: "National ID",
        idNumber: `ID-${Date.now()}`,
        address: {
          country: "USA",
          state: "CA",
          city: "Los Angeles",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      },
    });
  };

  const authFor = async (user: { _id: unknown; personalDetails: { email: string } }) =>
    generateTestToken({
      id: String(user._id),
      email: user.personalDetails.email,
      type: "user",
      role: "Customer",
    });

  const createTestRating = async (businessId: Types.ObjectId, userId: Types.ObjectId) => {
    return await Rating.create({
      businessId,
      userId,
      score: 4.5,
      comment: "Great food!",
    });
  };

  const expectProblem = (
    response: { statusCode: number; headers: Record<string, unknown>; json: () => any },
    status: number,
    typeSlug: string,
  ) => {
    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const body = response.json();
    expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
    expect(body.status).toBe(status);
    return body;
  };

  describe("POST /api/v1/ratings", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        payload: {
          businessId: business._id,
          score: 4.5,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("creates a rating and caches the business average", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const user = await createTestUser();
      const auth = await authFor(user);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        headers: { authorization: auth },
        payload: { businessId: String(business._id), score: 4 },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.score).toBe(4);
      expect(body.userId).toBe(String(user._id));

      const updated = await Business.findById(business._id).lean();
      expect(updated?.averageRating).toBe(4);
      expect(updated?.ratingCount).toBe(1);
    });

    it("sanitizes the comment as free text", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const user = await createTestUser();
      const auth = await authFor(user);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        headers: { authorization: auth },
        payload: {
          businessId: String(business._id),
          score: 5,
          comment: "<b>Great</b> food",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().comment).toBe("Great food");
    });

    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();
      const user = await createTestUser();
      const auth = await authFor(user);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        headers: { authorization: auth },
        payload: {},
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
          expect.objectContaining({ path: "score" }),
        ]),
      );
    });

    it("returns a validation problem for an out-of-range score", async () => {
      const app = await getTestApp();
      const user = await createTestUser();
      const auth = await authFor(user);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        headers: { authorization: auth },
        payload: { businessId: new Types.ObjectId().toString(), score: 10 },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "score" })]),
      );
    });

    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();
      const user = await createTestUser();
      const auth = await authFor(user);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        headers: { authorization: auth },
        payload: { businessId: "invalid-id", score: 4.5 },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "businessId" })]),
      );
    });

    it("rejects the server-owned userId as an unknown key", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const user = await createTestUser();
      const auth = await authFor(user);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        headers: { authorization: auth },
        payload: {
          businessId: String(business._id),
          score: 4,
          userId: String(user._id),
        },
      });

      expectProblem(response, 400, "validation");
    });
  });

  describe("GET /api/v1/ratings/:ratingId", () => {
    it("returns a validation problem for an invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ratings/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "ratingId" })]),
      );
    });

    it("returns a not-found problem for a non-existent rating", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Rating not found!");
    });

    it("gets rating by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const user = await createTestUser();
      const rating = await createTestRating(
        business._id as Types.ObjectId,
        user._id as Types.ObjectId
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/${rating._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(rating._id.toString());
      expect(body.score).toBe(4.5);
    });
  });

  describe("GET /api/v1/ratings/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ratings/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "businessId" })]),
      );
    });

    it("returns a validation problem for a non-numeric limit", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/business/${business._id}?limit=abc`,
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "limit" })]),
      );
    });

    it("rejects an unknown query key", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/business/${business._id}?sort=asc`,
      });

      expectProblem(response, 400, "validation");
    });

    it("returns empty array when no ratings for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("lists ratings by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const user = await createTestUser();
      await createTestRating(business._id as Types.ObjectId, user._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("supports pagination with limit and skip", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const user = await createTestUser();
      await createTestRating(business._id as Types.ObjectId, user._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/business/${business._id}?limit=5&skip=0`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
