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
  matchesSessionUserId,
} from "../canonicalPaths";

const userSession = {
  id: "u1",
  email: "u@test.local",
  type: "user" as const,
  role: "Customer" as const,
};

describe("canonicalPaths", () => {
  it("validates likely mongo object ids", () => {
    expect(isLikelyMongoObjectIdString("507f1f77bcf86cd799439011")).toBe(true);
    expect(isLikelyMongoObjectIdString("507f1f77bcf86cd79943901")).toBe(false);
    expect(isLikelyMongoObjectIdString(undefined)).toBe(false);
  });

  it("matches the session user id", () => {
    expect(matchesSessionUserId("u1", userSession)).toBe(true);
    expect(matchesSessionUserId("u2", userSession)).toBe(false);
    expect(matchesSessionUserId(undefined, userSession)).toBe(false);
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

  it("returns the Customer default dashboard for every signed-in User", () => {
    expect(canonicalDefaultDashboardPath(userSession)).toBe("/u1/customer/dashboard");
    expect(
      canonicalDefaultDashboardPath({
        ...userSession,
        mode: "business",
        role: "Manager",
      }),
    ).toBe("/u1/customer/dashboard");
  });
});
