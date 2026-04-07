import { describe, expect, it } from "vitest";
import {
  canonicalBusinessDashboardPath,
  canonicalBusinessDashboardRoutePath,
  canonicalBusinessProfilePath,
  canonicalBusinessSettingsAddressPath,
  canonicalBusinessSettingsCredentialsPath,
  canonicalBusinessSettingsDeliveryPath,
  canonicalBusinessSettingsMetricsPath,
  canonicalBusinessSettingsOpenHoursPath,
  canonicalBusinessSettingsSubscriptionsPath,
  canonicalDefaultDashboardPath,
  canonicalUserCustomerDashboardPath,
  canonicalUserCustomerFavoritesPath,
  canonicalUserCustomerPath,
  canonicalUserCustomerProfilePath,
  canonicalUserEmployeeDashboardPath,
  canonicalUserEmployeePath,
  canonicalUserEmployeeProfilePath,
  canonicalUserModePath,
  isLikelyMongoObjectIdString,
  matchesSessionBusinessId,
  matchesSessionUserId,
} from "../canonicalPaths";

const userSession = {
  id: "u1",
  email: "u@test.local",
  type: "user" as const,
  role: "Customer" as const,
};

const businessSession = {
  id: "b1",
  email: "b@test.local",
  type: "business" as const,
  role: "Tenant" as const,
};

describe("canonicalPaths", () => {
  it("validates likely mongo object ids", () => {
    expect(isLikelyMongoObjectIdString("507f1f77bcf86cd799439011")).toBe(true);
    expect(isLikelyMongoObjectIdString("507f1f77bcf86cd79943901")).toBe(false);
    expect(isLikelyMongoObjectIdString(undefined)).toBe(false);
  });

  it("matches session user id only for user sessions", () => {
    expect(matchesSessionUserId("u1", userSession)).toBe(true);
    expect(matchesSessionUserId("u2", userSession)).toBe(false);
    expect(matchesSessionUserId("u1", businessSession)).toBe(false);
    expect(matchesSessionUserId(undefined, userSession)).toBe(false);
  });

  it("matches session business id only for business sessions", () => {
    expect(matchesSessionBusinessId("b1", businessSession)).toBe(true);
    expect(matchesSessionBusinessId("b2", businessSession)).toBe(false);
    expect(matchesSessionBusinessId("b1", userSession)).toBe(false);
    expect(matchesSessionBusinessId(undefined, businessSession)).toBe(false);
  });

  it("builds all business canonical paths", () => {
    expect(canonicalBusinessDashboardPath(businessSession)).toBe("/business/b1");
    expect(canonicalBusinessDashboardRoutePath(businessSession)).toBe(
      "/business/b1/dashboard",
    );
    expect(canonicalBusinessProfilePath(businessSession)).toBe(
      "/business/b1/settings/profile",
    );
    expect(canonicalBusinessSettingsDeliveryPath(businessSession)).toBe(
      "/business/b1/settings/delivery",
    );
    expect(canonicalBusinessSettingsMetricsPath(businessSession)).toBe(
      "/business/b1/settings/metrics",
    );
    expect(canonicalBusinessSettingsSubscriptionsPath(businessSession)).toBe(
      "/business/b1/settings/subscriptions",
    );
    expect(canonicalBusinessSettingsAddressPath(businessSession)).toBe(
      "/business/b1/settings/address",
    );
    expect(canonicalBusinessSettingsOpenHoursPath(businessSession)).toBe(
      "/business/b1/settings/open-hours",
    );
    expect(canonicalBusinessSettingsCredentialsPath(businessSession)).toBe(
      "/business/b1/settings/credentials",
    );
  });

  it("builds all user canonical paths", () => {
    expect(canonicalUserCustomerPath(userSession)).toBe("/u1/customer");
    expect(canonicalUserCustomerDashboardPath(userSession)).toBe(
      "/u1/customer/dashboard",
    );
    expect(canonicalUserCustomerProfilePath(userSession)).toBe("/u1/customer/profile");
    expect(canonicalUserCustomerFavoritesPath(userSession)).toBe(
      "/u1/customer/favorites",
    );
    expect(canonicalUserModePath(userSession)).toBe("/u1/mode");
    expect(canonicalUserEmployeePath(userSession)).toBe("/u1/employee");
    expect(canonicalUserEmployeeDashboardPath(userSession)).toBe(
      "/u1/employee/dashboard",
    );
    expect(canonicalUserEmployeeProfilePath(userSession)).toBe("/u1/employee/profile");
  });

  it("returns type-based default dashboard path", () => {
    expect(canonicalDefaultDashboardPath(userSession)).toBe("/u1/customer/dashboard");
    expect(canonicalDefaultDashboardPath(businessSession)).toBe(
      "/business/b1/dashboard",
    );
  });
});
