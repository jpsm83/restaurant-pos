/**
 * MonthlyBusinessReport Routes Tests - Phase 1 Module 17
 * Tests for monthly business report endpoints
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

describe("MonthlyBusinessReport Routes", () => {
  const createTestBusiness = async (
    overrides: Record<string, unknown> = {},
  ) => {
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
      ...overrides,
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

  describe("business-local rollup boundaries", () => {
    const seedDailyReport = (
      businessId: Types.ObjectId,
      dailyReferenceNumber: number,
      createdAt: string,
      netPaid: number,
    ) =>
      DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: false,
        timeCountdownToClose: Date.now() + 86400000,
        dailyTotalSalesBeforeAdjustments: netPaid,
        dailyNetPaidAmount: netPaid,
        businessPaymentMethods: [],
        dailySoldGoods: [],
        dailyVoidedGoods: [],
        dailyInvitedGoods: [],
        createdAt: new Date(createdAt),
      });

    it("groups reports by the business-local month (west of UTC)", async () => {
      const business = await createTestBusiness({ timezone: "America/Bogota" });
      const businessId = business._id as Types.ObjectId;

      // Bogota is UTC-5; local October 2026 is the UTC interval
      // [2026-10-01T05:00Z, 2026-11-01T04:59:59.999Z].
      await seedDailyReport(businessId, 9401, "2026-10-01T04:59:59.999Z", 1000); // Sep 30 23:59 - previous month
      await seedDailyReport(businessId, 9402, "2026-10-01T05:00:00.000Z", 2000); // Oct 1 00:00 - this month
      await seedDailyReport(businessId, 9403, "2026-11-01T04:59:59.999Z", 4000); // Oct 31 23:59 - this month
      await seedDailyReport(businessId, 9404, "2026-11-01T05:00:00.000Z", 8000); // Nov 1 00:00 - next month

      await aggregateDailyReportsIntoMonthly(
        businessId,
        new Date("2026-10-15T12:00:00.000Z"),
      );

      const report = await MonthlyBusinessReport.findOne({ businessId }).lean();
      expect(report?.financialSummary?.totalSalesForMonth).toBe(6000);
      expect(report?.financialSummary?.totalNetRevenue).toBe(6000);
    });

    it("falls back to UTC when the business has no timezone", async () => {
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;

      // UTC October 2026 is the interval
      // [2026-10-01T00:00Z, 2026-10-31T23:59:59.999Z].
      await seedDailyReport(businessId, 9501, "2026-09-30T23:59:59.999Z", 1000); // previous month
      await seedDailyReport(businessId, 9502, "2026-10-01T00:00:00.000Z", 2000); // this month
      await seedDailyReport(businessId, 9503, "2026-10-31T23:59:59.999Z", 4000); // this month
      await seedDailyReport(businessId, 9504, "2026-11-01T00:00:00.000Z", 8000); // next month

      await aggregateDailyReportsIntoMonthly(
        businessId,
        new Date("2026-10-15T12:00:00.000Z"),
      );

      const report = await MonthlyBusinessReport.findOne({ businessId }).lean();
      expect(report?.financialSummary?.totalSalesForMonth).toBe(6000);
    });
  });
});
