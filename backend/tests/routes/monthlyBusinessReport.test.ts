/**
 * MonthlyBusinessReport Routes Tests - Phase 1 Module 17
 * Tests for monthly business report endpoints
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import MonthlyBusinessReport from "../../src/models/monthlyBusinessReport.ts";
import Business from "../../src/models/business.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Schedule from "../../src/models/schedule.ts";
import aggregateDailyReportsIntoMonthly from "../../src/monthlyBusinessReport/aggregateDailyReportsIntoMonthly.ts";

vi.mock("../../src/monthlyBusinessReport/sendMonthlyReportReadyNotification.ts", () => ({
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

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No monthly reports");
    });

    it("returns 400 for invalid businessId filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport?businessId=invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 400 for invalid month range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport?startMonth=2024-12&endMonth=2024-01",
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("Invalid month range");
    });

    it("returns 400 for a malformed month", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport?startMonth=2024-13&endMonth=2024-01",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("startMonth");
    });

    it("excludes soft-deleted reports by default and includes them when requested", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await MonthlyBusinessReport.create({
        businessId: business._id,
        monthReference: new Date("2024-02-01"),
        deleted: true,
        deletedAt: new Date(),
      });

      const hidden = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport",
      });
      const hiddenBody = expectProblem(hidden, 404, "not-found");
      expect(hiddenBody.detail).toContain("No monthly reports");

      const visible = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport?includeDeleted=true",
      });
      expect(visible.statusCode).toBe(200);
      expect(visible.json()).toHaveLength(1);
    });
  });

  describe("GET /api/v1/monthlyBusinessReport/:monthlyReportId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("monthlyReportId");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Monthly report not found!");
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

    it("returns 404 for soft-deleted report by default and 200 with includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const report = await MonthlyBusinessReport.create({
        businessId: business._id,
        monthReference: new Date("2024-03-01"),
        deleted: true,
        deletedAt: new Date(),
      });

      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/${report._id}`,
      });
      expect(hidden.statusCode).toBe(404);

      const visible = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/${report._id}?includeDeleted=true`,
      });
      expect(visible.statusCode).toBe(200);
      expect(visible.json().deleted).toBe(true);
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

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("monthlyReportId");
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

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("Provide at least one");
    });

    it("returns 404 for non-existent report", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/monthlyBusinessReport/${fakeId}`,
        payload: { totalFixedOperatingCost: 1500 },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Monthly report not found!");
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

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("closed");
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

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 404 when no reports for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No monthly reports");
    });

    it("returns 400 for invalid month range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}?startMonth=2024-12&endMonth=2024-01`,
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("Invalid month range");
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

    it("supports includeDeleted on business-scoped reads", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const deletedReport = await MonthlyBusinessReport.create({
        businessId: business._id,
        monthReference: new Date("2024-04-01"),
        deleted: true,
        deletedAt: new Date(),
      });

      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}`,
      });
      expect(hidden.statusCode).toBe(404);

      const visible = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}?includeDeleted=true`,
      });
      expect(visible.statusCode).toBe(200);
      expect(visible.json()[0]._id).toBe(deletedReport._id.toString());
    });
  });

  describe("GET /api/v1/monthlyBusinessReport/business/:businessId/calculateOnDemand", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/monthlyBusinessReport/business/invalid-id/calculateOnDemand",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 400 for invalid month query", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/monthlyBusinessReport/business/${business._id}/calculateOnDemand?month=invalid`,
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("month");
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

  describe("Phase 6 monthly KPI aggregation", () => {
    it("computes monthly net profit, net margin and break-even targets", async () => {
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;
      const anyDateInMonth = new Date("2026-10-15T12:00:00.000Z");
      const reportDate = new Date("2026-10-10T12:00:00.000Z");

      await DailySalesReport.create([
        {
          businessId,
          dailyReferenceNumber: Number(`${Date.now()}1`),
          isDailyReportOpen: false,
          timeCountdownToClose: Date.now() + 86400000,
          dailyTotalSalesBeforeAdjustments: 150,
          dailyNetPaidAmount: 135,
          dailyCostOfGoodsSold: 60,
          dailyTipsReceived: 10,
          dailyTotalVoidValue: 5,
          dailyTotalInvitedValue: 3,
          dailyCustomersServed: 6,
          dailyPosSystemCommission: 6,
          businessPaymentMethods: [],
          dailySoldGoods: [],
          dailyVoidedGoods: [],
          dailyInvitedGoods: [],
          createdAt: reportDate,
        },
      ]);

      await Schedule.create({
        businessId,
        date: reportDate,
        weekNumber: 1,
        employeesSchedules: [],
        totalEmployeesScheduled: 0,
        totalEmployeesVacation: 0,
        totalDayEmployeesCost: 30,
      });

      const monthReference = new Date("2026-10-01T00:00:00.000Z");

      await MonthlyBusinessReport.create({
        businessId,
        monthReference,
        isReportOpen: true,
        costBreakdown: {
          totalFixedOperatingCost: 30,
          totalExtraCost: 10,
        },
      });

      await aggregateDailyReportsIntoMonthly(businessId, anyDateInMonth);

      const created = await MonthlyBusinessReport.findOne({
        businessId,
        monthReference,
      }).lean();

      expect(created).toBeTruthy();
      expect(created?.financialSummary?.totalSalesForMonth).toBe(150);
      expect(created?.financialSummary?.totalNetRevenue).toBe(135);
      expect(created?.financialSummary?.totalCostOfGoodsSold).toBe(60);
      expect(created?.costBreakdown?.totalLaborCost).toBe(30);
      expect(created?.costBreakdown?.totalFixedOperatingCost).toBe(30);
      expect(created?.costBreakdown?.totalExtraCost).toBe(10);
      expect(created?.costBreakdown?.totalOperatingCost).toBe(130);
      expect(created?.financialSummary?.totalNetProfit).toBe(5);
      expect(
        created?.financialSummary?.financialPercentages?.netProfitMarginPercentage,
      ).toBeCloseTo(3.3333, 3);
      expect(created?.financialSummary?.breakEvenSales).toBeCloseTo(100, 6);
      expect(created?.financialSummary?.minimumDailySalesTarget).toBeGreaterThan(0);
    });
  });
});
