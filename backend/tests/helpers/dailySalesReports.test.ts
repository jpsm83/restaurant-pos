/**
 * Daily Sales Report Helpers Tests - Task 0.8
 * Tests for createDailySalesReport and updateEmployeeDailySalesReport
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { updateEmployeesDailySalesReport } from "../../src/dailySalesReports/updateEmployeeDailySalesReport.js";
import DailySalesReport from "../../src/models/dailySalesReport.js";

describe("Daily Sales Report Helpers", () => {
  const businessId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  describe("createDailySalesReport", () => {
    it("function exists and is callable", async () => {
      const { createDailySalesReport } = await import(
        "../../src/dailySalesReports/createDailySalesReport.js"
      );
      expect(typeof createDailySalesReport).toBe("function");
    });
  });

  describe("updateEmployeesDailySalesReport", () => {
    beforeEach(async () => {
      const dailyReferenceNumber = Date.now();
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });
    });

    it("returns error for invalid userIds", async () => {
      const result = await updateEmployeesDailySalesReport(
        ["invalid-id"] as any,
        Date.now()
      );

      expect(result.errors).toContain("Invalid userIds!");
      expect(result.updatedEmployees).toHaveLength(0);
    });

    it("returns error when dailyReferenceNumber is missing", async () => {
      const result = await updateEmployeesDailySalesReport(
        [userId],
        0 // falsy value
      );

      expect(result.errors).toContain("UserIds and dailyReferenceNumber are required!");
      expect(result.updatedEmployees).toHaveLength(0);
    });

    it("returns empty report for user with no sales instances", async () => {
      const dailyRefNum = Date.now();
      
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: dailyRefNum,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });

      const result = await updateEmployeesDailySalesReport([userId], dailyRefNum);

      expect(result.errors).toHaveLength(0);
      expect(result.updatedEmployees).toHaveLength(1);
      expect(result.updatedEmployees[0].userId.toString()).toBe(userId.toString());
      expect(result.updatedEmployees[0].totalNetPaidAmount).toBe(0);
      expect(result.updatedEmployees[0].totalTipsReceived).toBe(0);
      expect(result.updatedEmployees[0].totalCustomersServed).toBe(0);
    });

    it("handles multiple users", async () => {
      const dailyRefNum = Date.now() + 1;
      const userId2 = new Types.ObjectId();
      
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: dailyRefNum,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });

      const result = await updateEmployeesDailySalesReport(
        [userId, userId2],
        dailyRefNum
      );

      expect(result.errors).toHaveLength(0);
      expect(result.updatedEmployees).toHaveLength(2);
    });

    it("initializes employee report with correct default values", async () => {
      const dailyRefNum = Date.now() + 2;
      
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: dailyRefNum,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });

      const result = await updateEmployeesDailySalesReport([userId], dailyRefNum);

      expect(result.updatedEmployees).toHaveLength(1);
      const report = result.updatedEmployees[0];
      
      expect(report.hasOpenSalesInstances).toBe(false);
      expect(report.employeePaymentMethods).toEqual([]);
      expect(report.totalSalesBeforeAdjustments).toBe(0);
      expect(report.totalNetPaidAmount).toBe(0);
      expect(report.totalTipsReceived).toBe(0);
      expect(report.totalCostOfGoodsSold).toBe(0);
      expect(report.totalCustomersServed).toBe(0);
      expect(report.averageCustomerExpenditure).toBe(0);
    });
  });
});
