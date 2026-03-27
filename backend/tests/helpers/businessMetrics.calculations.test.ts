import { describe, expect, it } from "vitest";
import {
  avgSpendPerCustomer,
  barControls,
  barLaborCostPctOfBeverageSales,
  beverageContributionMargin,
  beverageContributionMarginPct,
  beverageCostPctOfBeverageSales,
  beverageVariancePct,
  beverageWastePct,
  breakEvenSales,
  calculateCostRatiosByOperatingCost,
  calculateCostRatiosByTotalSales,
  calculateFinancialPercentages,
  categorySalesMixPct,
  contributionMarginRatio,
  daypartGrossProfit,
  daypartGrossProfitMarginPct,
  daypartLaborPct,
  daypartSalesMixPct,
  daypart,
  fixedCostPctOfSales,
  foodContributionMargin,
  foodContributionMarginPct,
  foodWastePct,
  foodCostPctOfSales,
  grossProfit,
  grossProfitMarginPct,
  inventoryTurnover,
  invitedSalesPct,
  kitchenLaborCostPctOfFoodSales,
  laborCostPctOfSales,
  minimumDailySalesTarget,
  netProfit,
  netProfitMarginPct,
  primeCost,
  primeCostPctOfSales,
  promoDiscountRatePct,
  promoNetMarginLift,
  promoOrderSharePct,
  promoRoiProxy,
  promoSalesMixPct,
  promotions,
  profitability,
  costs,
  operations,
  targets,
  categoryMix,
  promoEffectiveness,
  pourCostPct,
  revenuePerSeatHour,
  revenuePerTableHour,
  roundCurrency,
  roundPercentage,
  safeDivide,
  salesPerLaborHour,
  salesPaymentCompletionPct,
  tableTurnoverRate,
  tipsToCostOfGoodsPct,
  toPercentage,
  voidSalesPct,
} from "../../src/reports/businessMetrics/calculations.ts";

describe("businessMetrics calculations helpers", () => {
  it("safeDivide and toPercentage handle normal and zero denominator", () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBe(0);
    expect(toPercentage(0.125)).toBe(12.5);
  });

  it("round helpers normalize to two decimals", () => {
    expect(roundCurrency(10.129)).toBe(10.13);
    expect(roundPercentage(33.335)).toBe(33.34);
  });

  it("profit helpers compute correct outputs", () => {
    const gp = grossProfit(140, 60);
    expect(gp).toBe(80);
    expect(grossProfitMarginPct(150, gp)).toBeCloseTo(53.3333, 3);

    const np = netProfit(140, 90);
    expect(np).toBe(50);
    expect(netProfitMarginPct(150, np)).toBeCloseTo(33.3333, 3);
  });

  it("profit helpers support negative-profit scenarios", () => {
    const np = netProfit(100, 140);
    expect(np).toBe(-40);
    expect(netProfitMarginPct(200, np)).toBe(-20);
  });

  it("cost helpers compute percentages and prime cost", () => {
    expect(foodCostPctOfSales(60, 150)).toBe(40);
    expect(laborCostPctOfSales(30, 150)).toBe(20);
    expect(primeCost(60, 30)).toBe(90);
    expect(primeCostPctOfSales(60, 30, 150)).toBe(60);
    expect(fixedCostPctOfSales(15, 150)).toBe(10);
  });

  it("sales quality helpers compute percentages", () => {
    expect(salesPaymentCompletionPct(150, 140)).toBeCloseTo(93.3333, 3);
    expect(voidSalesPct(150, 10)).toBeCloseTo(6.6666, 3);
    expect(invitedSalesPct(150, 5)).toBeCloseTo(3.3333, 3);
    expect(tipsToCostOfGoodsPct(10, 60)).toBeCloseTo(16.6666, 3);
  });

  it("avgSpendPerCustomer handles zero customers", () => {
    expect(avgSpendPerCustomer(140, 7)).toBe(20);
    expect(avgSpendPerCustomer(140, 0)).toBe(0);
  });

  it("operations helpers compute labor, inventory, table and waste metrics", () => {
    expect(salesPerLaborHour(300, 15)).toBe(20);
    expect(salesPerLaborHour(300, 0)).toBe(0);

    expect(inventoryTurnover(1200, 300)).toBe(4);
    expect(inventoryTurnover(1200, 0)).toBe(0);

    expect(tableTurnoverRate(120, 20, 6)).toBe(1);
    expect(tableTurnoverRate(120, 0, 6)).toBe(0);

    expect(foodWastePct(25, 500)).toBe(5);
    expect(foodWastePct(25, 0)).toBe(0);
    expect(beverageWastePct(10, 200)).toBe(5);
  });

  it("target and promotion helpers compute expected values", () => {
    const cmr = contributionMarginRatio(1000, 650);
    expect(cmr).toBe(0.35);

    const be = breakEvenSales(700, cmr);
    expect(be).toBeCloseTo(2000, 6);
    expect(breakEvenSales(700, 0)).toBe(0);

    expect(minimumDailySalesTarget(be, 20)).toBeCloseTo(100, 6);
    expect(minimumDailySalesTarget(be, 0)).toBe(0);

    expect(promoSalesMixPct(150, 1000)).toBe(15);
    expect(promoSalesMixPct(150, 0)).toBe(0);
    expect(promoDiscountRatePct(40, 1000)).toBe(4);
    expect(promoDiscountRatePct(40, 0)).toBe(0);
  });

  it("calculateFinancialPercentages composes core percentage helpers", () => {
    const result = calculateFinancialPercentages({
      totalSales: 150,
      totalNetRevenue: 140,
      totalGrossProfit: 80,
      totalVoidSales: 10,
      totalInvitedSales: 5,
      totalTips: 10,
      totalCostOfGoodsSold: 60,
    });

    expect(result.salesPaymentCompletionPercentage).toBeCloseTo(93.3333, 3);
    expect(result.profitMarginPercentage).toBeCloseTo(53.3333, 3);
    expect(result.voidSalesPercentage).toBeCloseTo(6.6666, 3);
    expect(result.invitedSalesPercentage).toBeCloseTo(3.3333, 3);
    expect(result.tipsToCostOfGoodsPercentage).toBeCloseTo(16.6666, 3);
  });

  it("calculateCostRatiosByOperatingCost returns normalized ratios", () => {
    const weekly = calculateCostRatiosByOperatingCost({
      totalFoodCost: 60,
      totalBeverageCost: 10,
      totalLaborCost: 30,
    });

    expect(weekly.foodCostRatio).toBeCloseTo(0.6, 6);
    expect(weekly.beverageCostRatio).toBeCloseTo(0.1, 6);
    expect(weekly.laborCostRatio).toBeCloseTo(0.3, 6);
    expect(weekly.fixedCostRatio).toBeUndefined();

    const monthly = calculateCostRatiosByOperatingCost({
      totalFoodCost: 60,
      totalBeverageCost: 10,
      totalLaborCost: 30,
      totalFixedOperatingCost: 20,
    });

    expect(monthly.foodCostRatio).toBeCloseTo(0.5, 6);
    expect(monthly.beverageCostRatio).toBeCloseTo(0.083333, 5);
    expect(monthly.laborCostRatio).toBeCloseTo(0.25, 6);
    expect(monthly.fixedCostRatio).toBeCloseTo(0.166666, 5);
  });

  it("calculateCostRatiosByTotalSales returns sales-based cost ratios", () => {
    const weekly = calculateCostRatiosByTotalSales({
      totalSales: 150,
      totalFoodCost: 60,
      totalBeverageCost: 10,
      totalLaborCost: 30,
    });

    expect(weekly.foodCostRatio).toBeCloseTo(0.4, 6);
    expect(weekly.beverageCostRatio).toBeCloseTo(0.066666, 5);
    expect(weekly.laborCostRatio).toBeCloseTo(0.2, 6);
    expect(weekly.fixedCostRatio).toBeUndefined();

    const monthly = calculateCostRatiosByTotalSales({
      totalSales: 200,
      totalFoodCost: 60,
      totalBeverageCost: 10,
      totalLaborCost: 30,
      totalFixedOperatingCost: 20,
    });

    expect(monthly.foodCostRatio).toBeCloseTo(0.3, 6);
    expect(monthly.beverageCostRatio).toBeCloseTo(0.05, 6);
    expect(monthly.laborCostRatio).toBeCloseTo(0.15, 6);
    expect(monthly.fixedCostRatio).toBeCloseTo(0.1, 6);
  });

  it("V2 beverage and category profitability helpers compute expected values", () => {
    expect(beverageCostPctOfBeverageSales(40, 200)).toBe(20);
    expect(foodContributionMargin(300, 120)).toBe(180);
    expect(beverageContributionMargin(200, 40)).toBe(160);
    expect(foodContributionMarginPct(300, 120)).toBe(60);
    expect(beverageContributionMarginPct(200, 40)).toBe(80);
    expect(barLaborCostPctOfBeverageSales(30, 200)).toBe(15);
    expect(kitchenLaborCostPctOfFoodSales(45, 300)).toBe(15);
  });

  it("T4 fixture: category food vs beverage contribution margins", () => {
    const fixture = {
      foodSales: 900,
      foodCogs: 360,
      beverageSales: 600,
      beverageCogs: 180,
    };

    expect(foodContributionMargin(fixture.foodSales, fixture.foodCogs)).toBe(540);
    expect(
      beverageContributionMargin(fixture.beverageSales, fixture.beverageCogs),
    ).toBe(420);
    expect(foodContributionMarginPct(fixture.foodSales, fixture.foodCogs)).toBe(60);
    expect(
      beverageContributionMarginPct(
        fixture.beverageSales,
        fixture.beverageCogs,
      ),
    ).toBe(70);
  });

  it("V2 sales mix and daypart helpers compute expected values", () => {
    expect(categorySalesMixPct(250, 1000)).toBe(25);
    expect(daypartSalesMixPct(400, 1000)).toBe(40);
    const gp = daypartGrossProfit(320, 110);
    expect(gp).toBe(210);
    expect(daypartGrossProfitMarginPct(400, gp)).toBe(52.5);
    expect(daypartLaborPct(80, 400)).toBe(20);
  });

  it("T4 fixture: daypart mix, margin and labor percentages", () => {
    const fixture = {
      totalSales: 1200,
      lunchSales: 450,
      lunchNetRevenue: 420,
      lunchCogs: 150,
      lunchLaborCost: 90,
    };

    const lunchGrossProfit = daypartGrossProfit(
      fixture.lunchNetRevenue,
      fixture.lunchCogs,
    );
    expect(daypartSalesMixPct(fixture.lunchSales, fixture.totalSales)).toBe(37.5);
    expect(lunchGrossProfit).toBe(270);
    expect(daypartGrossProfitMarginPct(fixture.lunchSales, lunchGrossProfit)).toBe(60);
    expect(daypartLaborPct(fixture.lunchLaborCost, fixture.lunchSales)).toBe(20);
  });

  it("V2 promotions helpers compute expected values", () => {
    expect(promoRoiProxy(120, 30)).toBe(4);
    expect(promoRoiProxy(120, 0)).toBe(0);
    expect(promoNetMarginLift(260, 200)).toBe(60);
    expect(promoOrderSharePct(45, 300)).toBe(15);
  });

  it("T4 fixture: promo ROI proxy zero-discount and normal scenarios", () => {
    expect(promoRoiProxy(180, 60)).toBe(3);
    expect(promoRoiProxy(180, 0)).toBe(0);
  });

  it("V2 bar controls helpers compute expected values", () => {
    expect(pourCostPct(55, 250)).toBe(22);
    expect(beverageVariancePct(110, 100)).toBe(10);
    expect(beverageVariancePct(90, 100)).toBe(-10);
    expect(revenuePerSeatHour(1000, 50)).toBe(20);
    expect(revenuePerTableHour(1000, 40)).toBe(25);
  });

  it("T4 fixture: pour cost and beverage variance from theoretical baseline", () => {
    expect(pourCostPct(120, 480)).toBe(25);
    expect(beverageVariancePct(105, 100)).toBe(5);
    expect(beverageVariancePct(95, 100)).toBe(-5);
  });

  it("grouped exports expose category namespaces", () => {
    expect(profitability.grossProfit(140, 60)).toBe(80);
    expect(costs.primeCost(60, 30)).toBe(90);
    expect(operations.inventoryTurnover(1200, 300)).toBe(4);
    expect(targets.breakEvenSales(700, 0.35)).toBeCloseTo(2000, 6);
    expect(promotions.promoSalesMixPct(150, 1000)).toBe(15);

    expect(categoryMix.categorySalesMixPct(250, 1000)).toBe(25);
    expect(daypart.daypartLaborPct(80, 400)).toBe(20);
    expect(barControls.pourCostPct(55, 250)).toBe(22);
    expect(promoEffectiveness.promoOrderSharePct(45, 300)).toBe(15);
  });
});
