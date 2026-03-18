/**
 * Ratings Routes Tests - Phase 1 Module 19
 * Tests for ratings endpoints
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import Rating from "../../src/models/rating.js";
import Business from "../../src/models/business.js";
import User from "../../src/models/user.js";

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

  const createTestRating = async (businessId: Types.ObjectId, userId: Types.ObjectId) => {
    return await Rating.create({
      businessId,
      userId,
      score: 4.5,
      comment: "Great food!",
    });
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

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        payload: { score: 4.5 },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid score (out of range)", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        payload: {
          businessId: new Types.ObjectId(),
          score: 10,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ratings",
        payload: {
          businessId: "invalid-id",
          score: 4.5,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/ratings/:ratingId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ratings/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid ratingId!");
    });

    it("returns 404 for non-existent rating", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ratings/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Rating not found!");
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
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ratings/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
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
