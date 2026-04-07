import { describe, expect, it } from "vitest";
import { queryKeys } from "../queryKeys";

describe("queryKeys", () => {
  it("returns stable auth keys", () => {
    expect(queryKeys.auth.me()).toEqual(["auth", "me"]);
    expect(queryKeys.auth.mode()).toEqual(["auth", "mode"]);
  });

  it("builds business and employee scoped keys", () => {
    expect(queryKeys.business.detail("b-1")).toEqual(["business", "detail", "b-1"]);
    expect(queryKeys.business.detailPending()).toEqual([
      "business",
      "detail",
      "pending",
    ]);
    expect(queryKeys.employees.managementContacts("b-1")).toEqual([
      "employees",
      "managementContacts",
      "b-1",
    ]);
  });

  it("builds schedule keys with fallbacks", () => {
    expect(queryKeys.schedules.byBusiness("b-1")).toEqual([
      "schedules",
      "business",
      "b-1",
      "current",
    ]);
    expect(queryKeys.schedules.byBusiness("b-1", "2026-04-07")).toEqual([
      "schedules",
      "business",
      "b-1",
      "2026-04-07",
    ]);
    expect(queryKeys.schedules.employeeDay("b-1", "e-1", "2026-04-07")).toEqual([
      "schedules",
      "employeeDay",
      "b-1",
      "e-1",
      "2026-04-07",
    ]);
    expect(queryKeys.schedules.employeeDayPending()).toEqual([
      "schedules",
      "employeeDay",
      "pending",
    ]);
  });
});
