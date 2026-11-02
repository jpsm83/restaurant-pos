import { describe, expect, it } from "vitest";
import {
  canonicalAccountAddressPath,
  canonicalAccountNotificationsPath,
  canonicalAccountPath,
  canonicalAccountProfilePath,
  canonicalBusinessCompanyPath,
  canonicalBusinessDashboardPath,
  canonicalBusinessDashboardRoutePath,
  canonicalBusinessPeoplePath,
  canonicalBusinessProfilePath,
  canonicalBusinessSettingsAddressPath,
  canonicalBusinessSettingsDeliveryPath,
  canonicalBusinessSettingsMetricsPath,
  canonicalBusinessSettingsOpenHoursPath,
  canonicalBusinessSettingsSubscriptionsPath,
  canonicalCustomerDashboardPath,
  canonicalCustomerFavoritesPath,
  canonicalDefaultDashboardPath,
  canonicalEmployeeDashboardPath,
  canonicalEmployeePath,
  canonicalEmployeeProfilePath,
  canonicalModePath,
  isLikelyMongoObjectIdString,
  isModeScopedPath,
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
    expect(canonicalBusinessPeoplePath("b1")).toBe("/business/b1/people");
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
    expect(canonicalAccountPath()).toBe("/account");
    expect(canonicalAccountProfilePath()).toBe("/account/profile");
    expect(canonicalAccountAddressPath()).toBe("/account/address");
    expect(canonicalAccountNotificationsPath()).toBe(
      "/account/notifications",
    );
    expect(canonicalCustomerFavoritesPath()).toBe("/favorites");
    expect(canonicalModePath()).toBe("/mode");
    expect(canonicalEmployeePath()).toBe("/employee");
    expect(canonicalEmployeeDashboardPath()).toBe("/employee/dashboard");
    expect(canonicalEmployeeProfilePath()).toBe("/employee/profile");
  });

  it("returns the Customer default dashboard", () => {
    expect(canonicalDefaultDashboardPath()).toBe("/dashboard");
  });

  it("scopes the stored mode to Customer, account, mode, and venue paths", () => {
    expect(isModeScopedPath("/dashboard")).toBe(true);
    expect(isModeScopedPath("/favorites")).toBe(true);
    expect(isModeScopedPath("/account/profile")).toBe(true);
    expect(isModeScopedPath("/mode")).toBe(true);
    expect(isModeScopedPath("/business/b1/dashboard")).toBe(true);

    expect(isModeScopedPath("/")).toBe(false);
    expect(isModeScopedPath("/business")).toBe(false);
    expect(isModeScopedPath("/login")).toBe(false);
  });
});
