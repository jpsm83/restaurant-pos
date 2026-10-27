import { describe, expect, it } from "vitest";

import {
  FEATURE_FLAG_CATALOGUE,
  FEATURE_FLAG_STATES,
  isFeatureFlagOn,
  resolveFeatureFlag,
  type FeatureFlagState,
  type FeatureFlagScopes,
} from "restaurant-pos-packages/featureFlags";

const EXPECTED_FLAGS = [
  { key: "corePosAndMenu", label: "Core POS and menu" },
  { key: "printersAndScreens", label: "Printers and screens" },
  { key: "floorPlans", label: "Floor plans" },
  { key: "promotions", label: "Promotions" },
  { key: "ratingsAndComments", label: "Ratings and comments" },
  { key: "giftCards", label: "Gift cards" },
  { key: "reservationsAndHost", label: "Reservations and Host" },
  {
    key: "suppliersPurchasesAndInventory",
    label: "Suppliers, purchases, and inventory",
  },
  {
    key: "employeesSchedulesAndTimeControl",
    label: "Employees, schedules, and time control",
  },
  { key: "payrollExport", label: "Payroll export" },
  { key: "dailySalesReports", label: "Daily sales reports" },
  { key: "weeklyBusinessReports", label: "Weekly business reports" },
  {
    key: "monthlyPnlAndAdvancedMetrics",
    label: "Full monthly P&L and advanced metrics",
  },
] as const;

const RESOLUTION_MATRIX: Array<{
  platform?: FeatureFlagState;
  owner?: FeatureFlagState;
  expected: FeatureFlagState;
}> = [
  { expected: "on" },
  { owner: "on", expected: "on" },
  { owner: "off", expected: "off" },
  { platform: "on", expected: "on" },
  { platform: "on", owner: "on", expected: "on" },
  { platform: "on", owner: "off", expected: "off" },
  { platform: "off", expected: "off" },
  { platform: "off", owner: "on", expected: "off" },
  { platform: "off", owner: "off", expected: "off" },
];

describe("feature flag catalogue contract", () => {
  it("exports exactly the thirteen stage-1 flags with canonical labels", () => {
    expect(
      FEATURE_FLAG_CATALOGUE.map(({ key, label }) => ({ key, label })),
    ).toEqual(EXPECTED_FLAGS);
  });

  it("defaults every flag on", () => {
    for (const flag of FEATURE_FLAG_CATALOGUE) {
      expect(flag.defaultState, `${flag.key} default state`).toBe("on");
    }
  });

  it("keeps every machine key unique", () => {
    const keys = FEATURE_FLAG_CATALOGUE.map((flag) => flag.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no selling-channel, payment-provider, Superadmin, quota, retention, billing, communications, or deployment flags", () => {
    const forbidden =
      /channel|stripe|payment|superadmin|quota|retention|billing|communication|deployment|email|inApp/i;

    for (const flag of FEATURE_FLAG_CATALOGUE) {
      expect(flag.key, `${flag.key} is not a non-product flag`).not.toMatch(
        forbidden,
      );
    }
  });

  it("exports the on and off states", () => {
    expect(FEATURE_FLAG_STATES).toEqual({ ON: "on", OFF: "off" });
  });

  it("exports the catalogue and its entries as runtime-immutable data", () => {
    expect(Object.isFrozen(FEATURE_FLAG_CATALOGUE)).toBe(true);
    for (const flag of FEATURE_FLAG_CATALOGUE) {
      expect(Object.isFrozen(flag), `${flag.key} is frozen`).toBe(true);
    }
  });
});

describe("effective feature flag resolution", () => {
  it("covers the full platform and per-Owner matrix for every flag, with boolean parity", () => {
    for (const flag of FEATURE_FLAG_CATALOGUE) {
      for (const { platform, owner, expected } of RESOLUTION_MATRIX) {
        const scopes: FeatureFlagScopes = { platform, owner };
        const context = `${flag.key} platform=${String(platform)} owner=${String(owner)}`;

        expect(resolveFeatureFlag(flag.key, scopes), context).toBe(expected);
        expect(isFeatureFlagOn(flag.key, scopes), context).toBe(
          expected === "on",
        );
      }
    }
  });

  it("returns on with no scopes for every flag", () => {
    for (const flag of FEATURE_FLAG_CATALOGUE) {
      expect(resolveFeatureFlag(flag.key), `${flag.key} no scopes`).toBe("on");
    }
  });

  it("is pure and deterministic", () => {
    const scopes = Object.freeze<FeatureFlagScopes>({
      platform: "on",
      owner: "off",
    });
    const snapshot = { ...scopes };

    expect(resolveFeatureFlag("giftCards", scopes)).toBe("off");
    expect(resolveFeatureFlag("giftCards", scopes)).toBe("off");
    expect(scopes).toEqual(snapshot);
  });

  it("throws for an unknown flag key", () => {
    expect(() => resolveFeatureFlag("notAProductFlag")).toThrow(
      /unknown feature flag/i,
    );
    expect(() => isFeatureFlagOn("notAProductFlag")).toThrow(
      /unknown feature flag/i,
    );
  });

  it("throws for an invalid platform-wide state", () => {
    expect(() =>
      resolveFeatureFlag("promotions", {
        platform: "enabled" as FeatureFlagState,
      }),
    ).toThrow(/invalid platform-wide feature flag state/i);
  });

  it("throws for an invalid per-Owner state", () => {
    expect(() =>
      resolveFeatureFlag("promotions", {
        owner: "0" as FeatureFlagState,
      }),
    ).toThrow(/invalid per-owner feature flag state/i);
  });

  it("validates every provided scope even when a platform off already decides the result", () => {
    expect(() =>
      resolveFeatureFlag("promotions", {
        platform: "off",
        owner: "disabled" as FeatureFlagState,
      }),
    ).toThrow(/invalid per-owner feature flag state/i);
  });
});
