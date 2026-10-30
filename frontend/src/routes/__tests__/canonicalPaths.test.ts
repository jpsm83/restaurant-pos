import { describe, expect, it } from "vitest";
import {
  canonicalBusinessCompanyPath,
  canonicalBusinessDashboardPath,
  canonicalBusinessDashboardRoutePath,
  canonicalBusinessProfilePath,
  canonicalBusinessSettingsAddressPath,
  canonicalBusinessSettingsDeliveryPath,
  canonicalBusinessSettingsMetricsPath,
  canonicalBusinessSettingsOpenHoursPath,
  canonicalBusinessSettingsSubscriptionsPath,
  canonicalCustomerDashboardPath,
  canonicalCustomerFavoritesPath,
  canonicalCustomerProfilePath,
  canonicalDefaultDashboardPath,
  canonicalEmployeeDashboardPath,
  canonicalEmployeePath,
  canonicalEmployeeProfilePath,
  canonicalModePath,
  isLikelyMongoObjectIdString,
} from "../canonicalPaths";

describe("canonicalPaths", () => {
  it("validates likely mongo object ids", () => {
    expect(isLikelyMongoObjectIdString("507f1f77bcf86cd799439011")).toBe(true);
    expect(isLikelyMongoObjectIdString("507f1f77bcf86cd79943901")).toBe(false);
    expect(isLikelyMongoObjectIdString(undefined)).toBe(false);
  });

  it("builds all venue canonical paths from the business id", () => {
    expect(canonicalBusinessDashboardPath("b1")).toBe("/business/b1");
    expect(canonicalBusinessDashboardRoutePath("b1")).toBe(
      "/business/b1/dashboard",
    );
    expect(canonicalBusinessCompanyPath("b1")).toBe("/business/b1/company");
    expect(canonicalBusinessProfilePath("b1")).toBe(
      "/business/b1/settings/profile",
    );
    expect(canonicalBusinessSettingsDeliveryPath("b1")).toBe(
      "/business/b1/settings/delivery",
    );
    expect(canonicalBusinessSettingsMetricsPath("b1")).toBe(
      "/business/b1/settings/metrics",
    );
    expect(canonicalBusinessSettingsSubscriptionsPath("b1")).toBe(
      "/business/b1/settings/subscriptions",
    );
    expect(canonicalBusinessSettingsAddressPath("b1")).toBe(
      "/business/b1/settings/address",
    );
    expect(canonicalBusinessSettingsOpenHoursPath("b1")).toBe(
      "/business/b1/settings/open-hours",
    );
  });

  it("builds the session-derived self-service paths without a user id", () => {
    expect(canonicalCustomerDashboardPath()).toBe("/dashboard");
    expect(canonicalCustomerProfilePath()).toBe("/profile");
    expect(canonicalCustomerFavoritesPath()).toBe("/favorites");
    expect(canonicalModePath()).toBe("/mode");
    expect(canonicalEmployeePath()).toBe("/employee");
    expect(canonicalEmployeeDashboardPath()).toBe("/employee/dashboard");
    expect(canonicalEmployeeProfilePath()).toBe("/employee/profile");
  });

  it("returns the Customer default dashboard", () => {
    expect(canonicalDefaultDashboardPath()).toBe("/dashboard");
  });
});
