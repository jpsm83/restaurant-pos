import { describe, it, expect } from "vitest";

import {
  computeWeeklyCommission,
  getPlan,
  resolveBaseCommissionPercent,
  subscriptionCatalogue,
} from "restaurant-pos-packages/utils/subscriptionCatalogue";

describe("subscriptionCatalogue", () => {
  it("seeds four named plans and a 2.5% card recovery pass-through", () => {
    expect(subscriptionCatalogue.cardRecovery.percent).toBe(0.025);
    expect(subscriptionCatalogue.cardRecovery.imperiumMarginPercent).toBe(0);
    expect(subscriptionCatalogue.plans.map((p) => p.id)).toEqual([
      "Free",
      "Basic",
      "Premium",
      "Enterprise",
    ]);
  });

  it("exposes Free base commission at 1%", () => {
    expect(getPlan("Free").baseCommissionPercent).toBe(0.01);
    expect(getPlan("Free").monthlyPrice).toBe(0);
  });

  it("computes weekly commission as base on all sales plus card recovery on card sales only", () => {
    // 10_000 commissionable, 6_000 card → Free: 1%×10000 + 2.5%×6000 = 100 + 150
    expect(
      computeWeeklyCommission({
        planId: "Free",
        commissionableSales: 10_000,
        cardCommissionableSales: 6_000,
      }),
    ).toEqual({
      baseCommission: 100,
      cardRecovery: 150,
      total: 250,
    });
  });

  it("uses Premium base rate without Imperium card margin", () => {
    // 10_000 all, 4_000 card → 0.4%×10000 + 2.5%×4000 = 40 + 100
    expect(
      computeWeeklyCommission({
        planId: "Premium",
        commissionableSales: 10_000,
        cardCommissionableSales: 4_000,
      }),
    ).toEqual({
      baseCommission: 40,
      cardRecovery: 100,
      total: 140,
    });
  });

  it("resolves missing or unknown plans to a zero base rate", () => {
    expect(resolveBaseCommissionPercent(undefined)).toBe(0);
    expect(resolveBaseCommissionPercent("Gold")).toBe(0);
  });
});
