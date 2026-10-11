/**
 * WeeklyBusinessReport Routes Tests - Phase 1 Module 16
 * Tests for weekly business report endpoints
 */

import { describe, it, expect, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.ts";
import Business from "../../src/models/business.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Schedule from "../../src/models/schedule.ts";
import aggregateDailyReportsIntoWeekly from "../../src/weeklyBusinessReport/aggregateDailyReportsIntoWeekly.ts";

vi.mock("../../src/weeklyBusinessReport/sendWeeklyReportReadyNotification.ts", () => ({
  default: vi.fn(async () => true),
}));

describe("WeeklyBusinessReport Routes", () => {
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

    it("groups reports by the business-local week (east of UTC)", async () => {
      const business = await createTestBusiness({ timezone: "Asia/Tokyo" });
      const businessId = business._id as Types.ObjectId;

      // Monday-start local week containing Wed 2026-10-14 is
      // Mon 2026-10-12 .. Sun 2026-10-18 (Japan, UTC+9), i.e. the UTC interval
      // [2026-10-11T15:00Z, 2026-10-18T14:59:59.999Z].
      await seedDailyReport(businessId, 9101, "2026-10-11T14:59:59.999Z", 1000); // Sun 23:59 JST - previous week
      await seedDailyReport(businessId, 9102, "2026-10-11T15:00:00.000Z", 2000); // Mon 00:00 JST - this week
      await seedDailyReport(businessId, 9103, "2026-10-18T14:59:59.999Z", 4000); // Sun 23:59 JST - this week
      await seedDailyReport(businessId, 9104, "2026-10-18T15:00:00.000Z", 8000); // Mon 00:00 JST - next week

      await aggregateDailyReportsIntoWeekly(
        businessId,
        new Date("2026-10-14T03:00:00.000Z"),
        1,
      );

      const report = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(report?.financialSummary?.totalSalesForWeek).toBe(6000);
      expect(report?.financialSummary?.totalNetRevenue).toBe(6000);
    });

    it("honors the configured weekly start day", async () => {
      const business = await createTestBusiness({ timezone: "Asia/Tokyo" });
      const businessId = business._id as Types.ObjectId;

      // With a Sunday start, the week containing Wed 2026-10-14 is
      // Sun 2026-10-11 .. Sat 2026-10-17 (Japan), i.e. the UTC interval
      // [2026-10-10T15:00Z, 2026-10-17T14:59:59.999Z].
      await seedDailyReport(businessId, 9201, "2026-10-10T14:59:59.999Z", 1000); // Sat 23:59 JST - previous week
      await seedDailyReport(businessId, 9202, "2026-10-10T15:00:00.000Z", 2000); // Sun 00:00 JST - this week
      await seedDailyReport(businessId, 9203, "2026-10-17T14:59:59.999Z", 4000); // Sat 23:59 JST - this week
      await seedDailyReport(businessId, 9204, "2026-10-17T15:00:00.000Z", 8000); // Sun 00:00 JST - next week

      await aggregateDailyReportsIntoWeekly(
        businessId,
        new Date("2026-10-14T03:00:00.000Z"),
        0,
      );

      const report = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(report?.financialSummary?.totalSalesForWeek).toBe(6000);
    });

    it("groups a week that crosses a DST transition by local boundaries", async () => {
      const business = await createTestBusiness({
        timezone: "America/Los_Angeles",
      });
      const businessId = business._id as Types.ObjectId;

      // The Monday-start week containing Wed 2026-03-11 runs Mon 2026-03-09 ..
      // Sun 2026-03-15 local. US clocks spring forward on Sun 2026-03-08, so the
      // week is entirely in PDT (UTC-7): the UTC interval
      // [2026-03-09T07:00Z, 2026-03-16T06:59:59.999Z].
      await seedDailyReport(businessId, 9401, "2026-03-09T06:59:59.999Z", 1000); // Sun 23:59 PDT - previous week
      await seedDailyReport(businessId, 9402, "2026-03-09T07:00:00.000Z", 2000); // Mon 00:00 PDT - this week
      await seedDailyReport(businessId, 9403, "2026-03-16T06:59:59.999Z", 4000); // Sun 23:59 PDT - this week
      await seedDailyReport(businessId, 9404, "2026-03-16T07:00:00.000Z", 8000); // Mon 00:00 PDT - next week

      await aggregateDailyReportsIntoWeekly(
        businessId,
        new Date("2026-03-11T18:00:00.000Z"),
        1,
      );

      const report = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(report?.financialSummary?.totalSalesForWeek).toBe(6000);
    });

    it("falls back to UTC when the business has no timezone", async () => {
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;

      // Monday-start UTC week containing Wed 2026-10-14 is
      // Mon 2026-10-12 .. Sun 2026-10-18, i.e. the UTC interval
      // [2026-10-12T00:00Z, 2026-10-18T23:59:59.999Z].
      await seedDailyReport(businessId, 9301, "2026-10-11T23:59:59.999Z", 1000); // previous week
      await seedDailyReport(businessId, 9302, "2026-10-12T00:00:00.000Z", 2000); // this week
      await seedDailyReport(businessId, 9303, "2026-10-18T23:59:59.999Z", 4000); // this week
      await seedDailyReport(businessId, 9304, "2026-10-19T00:00:00.000Z", 8000); // next week

      await aggregateDailyReportsIntoWeekly(
        businessId,
        new Date("2026-10-14T12:00:00.000Z"),
        1,
      );

      const report = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(report?.financialSummary?.totalSalesForWeek).toBe(6000);
    });
  });
});
