import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FEATURE_FLAG_CATALOGUE,
  resolveFeatureFlag,
} from "restaurant-pos-packages/featureFlags";

import {
  isAggregateMismatchCheckEnabled,
  isIncrementalEngineEnabledForBusiness,
} from "../src/dailySalesReports/rolloutControls.ts";

const DAILY_SALES_ENV_KEYS = [
  "DAILY_SALES_INCREMENTAL_ENGINE_MODE",
  "DAILY_SALES_INCREMENTAL_BUSINESS_IDS",
  "DAILY_SALES_AGGREGATE_MISMATCH_CHECK",
];

const NON_PRODUCT_CONTROL_IDENTIFIERS = [
  "COMMUNICATIONS_EMAIL_ENABLED",
  "COMMUNICATIONS_INAPP_ENABLED",
  "COMMUNICATIONS_INAPP_LIVE_ENABLED",
  "AUTH_EMAIL_DEV_SINK_ENABLED",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  ...DAILY_SALES_ENV_KEYS,
  "enableDateToolbarFilter",
  "canCommitWrite",
  "canLogAsEmployee",
];

const ORIGINAL_ENV = { ...process.env };

const businessId = new Types.ObjectId();
const otherBusinessId = new Types.ObjectId();

const normalize = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, "").toLowerCase();

function withEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe("feature flag catalogue boundaries", () => {
  it("keeps deployment, component, concurrency, and access controls out", () => {
    const tokens = FEATURE_FLAG_CATALOGUE.map(({ key }) => normalize(key));

    for (const identifier of NON_PRODUCT_CONTROL_IDENTIFIERS) {
      expect(tokens, `${identifier} is not a catalogue key`).not.toContain(
        normalize(identifier),
      );
    }
  });

  it("does not resolve a control as a product flag", () => {
    for (const identifier of NON_PRODUCT_CONTROL_IDENTIFIERS) {
      expect(
        () => resolveFeatureFlag(identifier),
        `${identifier} is not a product flag`,
      ).toThrow(/unknown feature flag/i);
    }
  });
});

describe("daily-sales deployment controls stay outside the flag rail", () => {
  beforeEach(() => {
    for (const key of DAILY_SALES_ENV_KEYS) withEnv(key, undefined);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults the incremental engine on and ignores a product flag off", () => {
    expect(isIncrementalEngineEnabledForBusiness(businessId)).toBe(true);
    expect(resolveFeatureFlag("dailySalesReports", { platform: "off" })).toBe(
      "off",
    );
    expect(isIncrementalEngineEnabledForBusiness(businessId)).toBe(true);
  });

  it("keeps the incremental engine off mode", () => {
    withEnv("DAILY_SALES_INCREMENTAL_ENGINE_MODE", "off");

    expect(isIncrementalEngineEnabledForBusiness(businessId)).toBe(false);
  });

  it("keeps the business allow-list mode", () => {
    withEnv("DAILY_SALES_INCREMENTAL_ENGINE_MODE", "business-list");
    withEnv("DAILY_SALES_INCREMENTAL_BUSINESS_IDS", ` ${businessId} , `);

    expect(isIncrementalEngineEnabledForBusiness(businessId)).toBe(true);
    expect(isIncrementalEngineEnabledForBusiness(otherBusinessId)).toBe(false);
  });

  it("keeps the aggregate-mismatch check default off and its explicit opt-in", () => {
    expect(isAggregateMismatchCheckEnabled()).toBe(false);

    withEnv("DAILY_SALES_AGGREGATE_MISMATCH_CHECK", "true");
    expect(isAggregateMismatchCheckEnabled()).toBe(true);

    withEnv("DAILY_SALES_AGGREGATE_MISMATCH_CHECK", "false");
    expect(isAggregateMismatchCheckEnabled()).toBe(false);
  });
});
