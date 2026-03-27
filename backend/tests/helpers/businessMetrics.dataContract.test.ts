import { describe, expect, it } from "vitest";
import {
  getVariableCostsV1,
  mapDailyReportToCanonicalInputs,
} from "../../src/reports/businessMetrics/dataContract.ts";

describe("businessMetrics data contract mapping", () => {
  it("maps DSR top-level fields to canonical inputs", () => {
    const mapped = mapDailyReportToCanonicalInputs({
      dailyTotalSalesBeforeAdjustments: 150,
      dailyNetPaidAmount: 140,
      dailyCostOfGoodsSold: 60,
      dailyTipsReceived: 10,
      dailyTotalVoidValue: 5,
      dailyTotalInvitedValue: 3,
      dailyCustomersServed: 7,
      dailyPosSystemCommission: 12,
    });

    expect(mapped.totalSales).toBe(150);
    expect(mapped.netRevenue).toBe(140);
    expect(mapped.cogs).toBe(60);
    expect(mapped.tips).toBe(10);
    expect(mapped.voidSales).toBe(5);
    expect(mapped.invitedSales).toBe(3);
    expect(mapped.customersServed).toBe(7);
    expect(mapped.posSystemCommission).toBe(12);
  });

  it("normalizes undefined values to zero", () => {
    const mapped = mapDailyReportToCanonicalInputs({});
    expect(mapped.totalSales).toBe(0);
    expect(mapped.netRevenue).toBe(0);
    expect(mapped.cogs).toBe(0);
    expect(mapped.tips).toBe(0);
    expect(mapped.voidSales).toBe(0);
    expect(mapped.invitedSales).toBe(0);
    expect(mapped.customersServed).toBe(0);
    expect(mapped.posSystemCommission).toBe(0);
  });

  it("uses V1 variable-cost policy as COGS + labor", () => {
    expect(getVariableCostsV1(60, 30)).toBe(90);
  });
});
