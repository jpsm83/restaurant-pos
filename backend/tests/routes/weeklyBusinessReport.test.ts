/**
 * WeeklyBusinessReport Routes Tests - Phase 1 Module 16
 * Tests for weekly business report endpoints
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.js";
import Business from "../../src/models/business.js";

describe("WeeklyBusinessReport Routes", () => {
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

  const createTestWeeklyReport = async (businessId: Types.ObjectId) => {
    return await WeeklyBusinessReport.create({
      businessId,
      weekReference: new Date("2024-01-01"),
      weeklyTotalSales: 1000,
      weeklyNetPaidAmount: 900,
      weeklyTipsReceived: 100,
      weeklyCostOfGoodsSold: 300,
      weeklyProfit: 600,
      weeklyCustomersServed: 50,
    });
  };

  describe("GET /api/v1/weeklyBusinessReport", () => {
    it("lists all weekly reports", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestWeeklyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 404 when no reports exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No weekly reports");
    });

    it("returns 400 for invalid businessId filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport?businessId=invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 400 for invalid week range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport?startWeek=2024-12-31&endWeek=2024-01-01",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid week range");
    });

    it("filters by businessId", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestWeeklyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport?businessId=${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("GET /api/v1/weeklyBusinessReport/:weeklyReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid weekly report ID!");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Weekly report not found!");
    });

    it("gets weekly report by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestWeeklyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/${report._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(report._id.toString());
    });
  });

  describe("GET /api/v1/weeklyBusinessReport/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 404 when no reports for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No weekly reports");
    });

    it("returns 400 for invalid week range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${business._id}?startWeek=2024-12-31&endWeek=2024-01-01`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid week range");
    });

    it("lists weekly reports by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestWeeklyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
