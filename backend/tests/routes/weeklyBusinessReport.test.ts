/**
 * WeeklyBusinessReport Routes Tests - Phase 1 Module 16
 * Tests for weekly business report endpoints
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Schedule from "../../src/models/schedule.ts";
import aggregateDailyReportsIntoWeekly from "../../src/weeklyBusinessReport/aggregateDailyReportsIntoWeekly.ts";
import { createTestBusiness as createCompanyAwareBusiness } from "../helpers/fixtures.ts";

vi.mock("../../src/weeklyBusinessReport/sendWeeklyReportReadyNotification.ts", () => ({
  default: vi.fn(async () => true),
}));

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
  expect(response.headers["content-type"]).toContain("application/problem+json");
  const body = response.json();
  expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
  expect(body.status).toBe(status);
  return body;
};

const fieldPaths = (body: { errors?: Array<{ path: string }> }): string[] =>
  (body.errors ?? []).map((e) => e.path);

describe("WeeklyBusinessReport Routes", () => {
  const createTestBusiness = async () =>
    createCompanyAwareBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
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

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No weekly reports");
    });

    it("returns 400 for invalid businessId filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport?businessId=invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 400 for invalid week range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport?startWeek=2024-12-31&endWeek=2024-01-01",
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("Invalid week range");
    });

    it("returns 400 for a malformed week date", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport?startWeek=not-a-date&endWeek=2024-01-07",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("startWeek");
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

    it("excludes soft-deleted reports by default and includes them when requested", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await WeeklyBusinessReport.create({
        businessId: business._id,
        weekReference: new Date("2024-02-05"),
        deleted: true,
        deletedAt: new Date(),
      });

      const activeOnly = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport",
      });
      const activeBody = expectProblem(activeOnly, 404, "not-found");
      expect(activeBody.detail).toContain("No weekly reports");

      const includeDeleted = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport?includeDeleted=true",
      });
      expect(includeDeleted.statusCode).toBe(200);
      expect(includeDeleted.json()).toHaveLength(1);
    });
  });

  describe("GET /api/v1/weeklyBusinessReport/:weeklyReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("weeklyReportId");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Weekly report not found!");
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

    it("returns 404 for soft-deleted report by default and 200 with includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await WeeklyBusinessReport.create({
        businessId: business._id,
        weekReference: new Date("2024-03-04"),
        deleted: true,
        deletedAt: new Date(),
      });

      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/${report._id}`,
      });
      expect(hidden.statusCode).toBe(404);

      const visible = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/${report._id}?includeDeleted=true`,
      });
      expect(visible.statusCode).toBe(200);
      expect(visible.json().deleted).toBe(true);
    });
  });

  describe("GET /api/v1/weeklyBusinessReport/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 404 when no reports for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No weekly reports");
    });

    it("returns 400 for invalid week range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${business._id}?startWeek=2024-12-31&endWeek=2024-01-01`,
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("Invalid week range");
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

    it("supports includeDeleted on business-scoped reads", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const deletedReport = await WeeklyBusinessReport.create({
        businessId: business._id,
        weekReference: new Date("2024-04-01"),
        deleted: true,
        deletedAt: new Date(),
      });

      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${business._id}`,
      });
      expect(hidden.statusCode).toBe(404);

      const visible = await app.inject({
        method: "GET",
        url: `/api/v1/weeklyBusinessReport/business/${business._id}?includeDeleted=true`,
      });
      expect(visible.statusCode).toBe(200);
      expect(visible.json()[0]._id).toBe(deletedReport._id.toString());
    });
  });

  describe("Phase 5 weekly KPI aggregation", () => {
    it("computes weekly financial and cost KPIs from daily reports", async () => {
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;
      const now = new Date();

      await DailySalesReport.create([
        {
          businessId,
          dailyReferenceNumber: Number(`${Date.now()}1`),
          isDailyReportOpen: false,
          timeCountdownToClose: Date.now() + 86400000,
          dailyTotalSalesBeforeAdjustments: 100,
          dailyNetPaidAmount: 90,
          dailyCostOfGoodsSold: 40,
          dailyTipsReceived: 10,
          dailyTotalVoidValue: 5,
          dailyTotalInvitedValue: 3,
          dailyCustomersServed: 4,
          dailyPosSystemCommission: 5,
          businessPaymentMethods: [],
          dailySoldGoods: [],
          dailyVoidedGoods: [],
          dailyInvitedGoods: [],
        },
        {
          businessId,
          dailyReferenceNumber: Number(`${Date.now()}2`),
          isDailyReportOpen: false,
          timeCountdownToClose: Date.now() + 86400000,
          dailyTotalSalesBeforeAdjustments: 50,
          dailyNetPaidAmount: 45,
          dailyCostOfGoodsSold: 20,
          dailyTipsReceived: 5,
          dailyTotalVoidValue: 2,
          dailyTotalInvitedValue: 1,
          dailyCustomersServed: 2,
          dailyPosSystemCommission: 2,
          businessPaymentMethods: [],
          dailySoldGoods: [],
          dailyVoidedGoods: [],
          dailyInvitedGoods: [],
        },
      ]);

      await Schedule.create({
        businessId,
        date: now,
        weekNumber: 1,
        employeesSchedules: [],
        totalEmployeesScheduled: 0,
        totalEmployeesVacation: 0,
        totalDayEmployeesCost: 30,
      });

      await aggregateDailyReportsIntoWeekly(businessId, now, 1);

      const created = await WeeklyBusinessReport.findOne({
        businessId,
      })
        .sort({ createdAt: -1 })
        .lean();

      expect(created).toBeTruthy();
      expect(created?.financialSummary?.totalSalesForWeek).toBe(150);
      expect(created?.financialSummary?.totalNetRevenue).toBe(135);
      expect(created?.financialSummary?.totalCostOfGoodsSold).toBe(60);
      expect(created?.financialSummary?.totalGrossProfit).toBe(75);
      expect(
        created?.financialSummary?.financialPercentages?.salesPaymentCompletionPercentage,
      ).toBeCloseTo(90, 6);
      expect(
        created?.financialSummary?.financialPercentages?.profitMarginPercentage,
      ).toBeCloseTo(50, 6);
      expect(created?.costBreakdown?.totalOperatingCost).toBe(90);
      expect(created?.costBreakdown?.costPercentages?.foodCostRatio).toBeCloseTo(
        60 / 150,
        6,
      );
      expect(created?.averageSpendingPerCustomer).toBeCloseTo(22.5, 6);
    });

    it("keeps a soft-deleted daily report in the weekly derivation", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;
      const now = new Date();

      await DailySalesReport.create([
        {
          businessId,
          dailyReferenceNumber: Number(`${Date.now()}3`),
          isDailyReportOpen: false,
          timeCountdownToClose: Date.now() + 86400000,
          dailyTotalSalesBeforeAdjustments: 20,
          dailyNetPaidAmount: 10,
          dailyCostOfGoodsSold: 4,
          dailyTipsReceived: 1,
          dailyTotalVoidValue: 0,
          dailyTotalInvitedValue: 0,
          dailyCustomersServed: 1,
          dailyPosSystemCommission: 1,
          businessPaymentMethods: [],
          dailySoldGoods: [],
          dailyVoidedGoods: [],
          dailyInvitedGoods: [],
        },
        {
          businessId,
          dailyReferenceNumber: Number(`${Date.now()}4`),
          isDailyReportOpen: false,
          timeCountdownToClose: Date.now() + 86400000,
          deleted: true,
          deletedAt: new Date(),
          dailyTotalSalesBeforeAdjustments: 80,
          dailyNetPaidAmount: 70,
          dailyCostOfGoodsSold: 16,
          dailyTipsReceived: 2,
          dailyTotalVoidValue: 0,
          dailyTotalInvitedValue: 0,
          dailyCustomersServed: 3,
          dailyPosSystemCommission: 2,
          businessPaymentMethods: [],
          dailySoldGoods: [],
          dailyVoidedGoods: [],
          dailyInvitedGoods: [],
        },
      ]);

      await aggregateDailyReportsIntoWeekly(businessId, now, 1);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/weeklyBusinessReport",
      });
      expect(response.statusCode).toBe(200);
      const reports = response.json() as Array<{
        financialSummary?: { totalSalesForWeek?: number; totalNetRevenue?: number };
      }>;
      expect(reports[0]?.financialSummary?.totalSalesForWeek).toBe(100);
      expect(reports[0]?.financialSummary?.totalNetRevenue).toBe(80);
    });
  });
});
