/**
 * DailySalesReports Routes Tests - Phase 1 Module 15
 * Tests for daily sales reports CRUD endpoints
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Business from "../../src/models/business.ts";

describe("DailySalesReports Routes", () => {
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

  const createTestDailySalesReport = async (businessId: Types.ObjectId) => {
    return await DailySalesReport.create({
      businessId,
      dailyReferenceNumber: Date.now(),
      isDailyReportOpen: true,
      timeCountdownToClose: 3600,
      employeesDailySalesReport: [],
      businessPaymentMethods: [],
      dailyTotalSalesBeforeAdjustments: 0,
      dailyNetPaidAmount: 0,
      dailyTipsReceived: 0,
      dailyCostOfGoodsSold: 0,
      dailyProfit: 0,
      dailyCustomersServed: 0,
    });
  };

  describe("GET /api/v1/dailySalesReports", () => {
    it("lists all daily sales reports", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestDailySalesReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dailySalesReports",
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
        url: "/api/v1/dailySalesReports",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No daily reports");
    });
  });

  describe("GET /api/v1/dailySalesReports/:dailySalesReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dailySalesReports/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid daily report ID!");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Daily report not found!");
    });

    it("gets daily sales report by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestDailySalesReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/${report._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(report._id.toString());
    });
  });

  describe("DELETE /api/v1/dailySalesReports/:dailySalesReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/dailySalesReports/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid daily report ID!");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/dailySalesReports/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Daily report not found!");
    });

    it("deletes daily sales report successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestDailySalesReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/dailySalesReports/${report._id}`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("PATCH /api/v1/dailySalesReports/:dailySalesReportId/calculateBusinessReport", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestDailySalesReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${report._id}/calculateBusinessReport`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/dailySalesReports/invalid-id/calculateBusinessReport",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /api/v1/dailySalesReports/:dailySalesReportId/calculateUsersReport", () => {
    it("returns 400 for missing userIds", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${fakeId}/calculateUsersReport`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("non-empty array");
    });

    it("returns 400 for empty userIds array", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${fakeId}/calculateUsersReport`,
        payload: { userIds: [] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("non-empty array");
    });

    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/dailySalesReports/invalid-id/calculateUsersReport",
        payload: { userIds: ["user1"] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeReportId = new Types.ObjectId();
      const fakeUserId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${fakeReportId}/calculateUsersReport`,
        payload: { userIds: [fakeUserId.toString()] },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Daily sales report not found!");
    });
  });

  describe("PATCH /api/v1/dailySalesReports/:dailySalesReportId/close", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await createTestDailySalesReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${report._id}/close`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/dailySalesReports/invalid-id/close",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/dailySalesReports/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dailySalesReports/business/invalid-id",
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
        url: `/api/v1/dailySalesReports/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No daily reports");
    });

    it("returns 400 for invalid date range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/business/${business._id}?startDate=2024-12-31&endDate=2024-01-01`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid date range");
    });

    it("lists daily sales reports by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestDailySalesReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
