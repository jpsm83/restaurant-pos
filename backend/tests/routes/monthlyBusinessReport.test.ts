/**
 * MonthlyBusinessReport Routes Tests - Phase 1 Module 17
 * Tests for monthly business report endpoints
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import MonthlyBusinessReport from "../../src/models/monthlyBusinessReport.js";
import Business from "../../src/models/business.js";

describe("MonthlyBusinessReport Routes", () => {
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

  const createTestMonthlyReport = async (businessId: Types.ObjectId, isOpen = true) => {
    return await MonthlyBusinessReport.create({
      businessId,
      monthReference: new Date("2024-01-01"),
      isReportOpen: isOpen,
      financialSummary: {
        totalSalesForMonth: 10000,
        totalCostOfGoodsSold: 3000,
        totalNetRevenue: 9000,
        totalGrossProfit: 6000,
      },
      costBreakdown: {
        totalFoodCost: 3000,
        totalBeverageCost: 500,
        totalLaborCost: 2000,
        totalFixedOperatingCost: 1000,
        totalExtraCost: 200,
        totalOperatingCost: 6700,
      },
      totalCustomersServed: 500,
    });
  };

  describe("GET /api/v1/monthlyBusinessReport", () => {
    it("lists all monthly reports", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestMonthlyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport",
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
        url: "/api/v1/monthlyBusinessReport",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No monthly reports");
    });

    it("returns 400 for invalid businessId filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport?businessId=invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 400 for invalid month range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport?startMonth=2024-12&endMonth=2024-01",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid month range");
    });
  });

  describe("GET /api/v1/monthlyBusinessReport/:monthlyReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid monthly report ID!");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Monthly report not found!");
    });

    it("gets monthly report by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestMonthlyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/${report._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(report._id.toString());
    });
  });

  describe("PATCH /api/v1/monthlyBusinessReport/:monthlyReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/monthlyBusinessReport/invalid-id",
        payload: { totalFixedOperatingCost: 1500 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid monthly report ID!");
    });

    it("returns 400 when no update fields provided", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestMonthlyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/monthlyBusinessReport/${report._id}`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Provide at least one");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/monthlyBusinessReport/${fakeId}`,
        payload: { totalFixedOperatingCost: 1500 },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Monthly report not found!");
    });

    it("returns 400 when updating closed report", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestMonthlyReport(business._id as Types.ObjectId, false);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/monthlyBusinessReport/${report._id}`,
        payload: { totalFixedOperatingCost: 1500 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("closed");
    });

    it("updates report successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestMonthlyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/monthlyBusinessReport/${report._id}`,
        payload: { totalFixedOperatingCost: 1500 },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("GET /api/v1/monthlyBusinessReport/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport/business/invalid-id",
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
        url: `/api/v1/monthlyBusinessReport/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No monthly reports");
    });

    it("returns 400 for invalid month range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}?startMonth=2024-12&endMonth=2024-01`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid month range");
    });

    it("lists monthly reports by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestMonthlyReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/v1/monthlyBusinessReport/business/:businessId/calculateOnDemand", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport/business/invalid-id/calculateOnDemand",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 400 for invalid month query", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}/calculateOnDemand?month=invalid`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid month query");
    });

    it("calculates on demand successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}/calculateOnDemand?month=2024-01`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.businessId).toBe(business._id.toString());
      expect(body.financialSummary).toBeDefined();
      expect(body.costBreakdown).toBeDefined();
    });
  });
});
