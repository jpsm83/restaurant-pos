/**
 * SalesInstances Routes Tests - Phase 1 Module 5
 * Tests for sales instances CRUD endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";

describe("SalesInstances Routes", () => {
  let businessId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let userId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
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

    const salesPoint = await SalesPoint.create({
      businessId,
      salesPointName: "Table 1",
      salesPointType: "Table",
    });
    salesPointId = salesPoint._id;

    const user = await User.create({
      personalDetails: {
        email: "user@test.com",
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
        idNumber: "ID123456",
        idType: "Passport",
        username: "testuser",
      },
      allUserRoles: ["Customer"],
    });
    userId = user._id;
  });

  describe("GET /api/v1/salesInstances", () => {
    it("lists all sales instances", async () => {
      const app = await getTestApp();

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 4,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesInstances",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 404 when no sales instances exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesInstances",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/salesInstances/:salesInstanceId", () => {
    it("gets sales instance by ID", async () => {
      const app = await getTestApp();

      const salesInstance = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 2,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesInstances/${salesInstance._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guests).toBe(2);
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesInstances/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid salesInstanceId!");
    });

    it("returns 404 for non-existent sales instance", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesInstances/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/salesInstances", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances",
        payload: {
          salesPointId: salesPointId.toString(),
          guests: 4,
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/salesInstances/:salesInstanceId", () => {
    it("returns 400 for invalid salesInstanceId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/salesInstances/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid salesInstanceId");
    });

    it("deletes empty sales instance", async () => {
      const app = await getTestApp();

      const salesInstance = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 2,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/salesInstances/${salesInstance._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Sales instance deleted successfully!");
    });

    it("returns 404 for non-existent sales instance", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/salesInstances/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/salesInstances/business/:businessId", () => {
    it("lists sales instances by business", async () => {
      const app = await getTestApp();

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 4,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesInstances/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesInstances/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 404 when business has no sales instances", async () => {
      const app = await getTestApp();
      const emptyBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesInstances/business/${emptyBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/salesInstances/user/:userId", () => {
    it("lists sales instances by user", async () => {
      const app = await getTestApp();

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 4,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesInstances/user/${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesInstances/user/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid userId!");
    });

    it("returns 404 when user has no sales instances", async () => {
      const app = await getTestApp();
      const emptyUserId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesInstances/user/${emptyUserId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/v1/salesInstances/:salesInstanceId/transferSalesPoint", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${fakeId}/transferSalesPoint`,
        payload: { salesPointId: salesPointId.toString() },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/salesInstances/delivery", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances/delivery",
        payload: {
          businessId: businessId.toString(),
          ordersArr: [],
          paymentMethodArr: [],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
