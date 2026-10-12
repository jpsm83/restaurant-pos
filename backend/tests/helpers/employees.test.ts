/**
 * Employee post-parse helper tests — the cross-field date rule and the salary
 * shape check that the DTO leaves to the route.
 */

import { describe, it, expect } from "vitest";

import validateEmployeeDates from "../../src/employees/validateEmployeeDates.ts";
import validateSalary from "../../src/employees/validateSalary.ts";

describe("validateSalary", () => {
  const validSalary = {
    payFrequency: "Hourly",
    grossSalary: 20,
    netSalary: 15,
  };

  it("returns true for a complete, valid salary", () => {
    expect(validateSalary(validSalary)).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(validateSalary(null)).toBe("Salary must be a non-null object!");
    expect(validateSalary("salary")).toBe("Salary must be a non-null object!");
  });

  it("requires every field to be present", () => {
    const { netSalary: _drop, ...withoutNet } = validSalary;
    expect(validateSalary(withoutNet)).toBe("Missing key: netSalary");
  });

  it("requires every present field to have a value", () => {
    expect(validateSalary({ ...validSalary, grossSalary: 0 })).toBe(
      "grossSalary must have a value!",
    );
  });

  it("rejects an unknown key", () => {
    expect(validateSalary({ ...validSalary, bonus: 10 })).toBe(
      "Invalid key: bonus",
    );
  });

  it("rejects an unknown pay frequency", () => {
    expect(validateSalary({ ...validSalary, payFrequency: "Fortnightly" })).toBe(
      "Invalid pay frequency!",
    );
  });
});

describe("validateEmployeeDates", () => {
  const joinDate = new Date("2024-01-15");

  it("returns true when there is no terminatedDate", () => {
    expect(validateEmployeeDates(joinDate)).toBe(true);
    expect(validateEmployeeDates(joinDate, undefined)).toBe(true);
  });

  it("returns true when terminatedDate is after joinDate", () => {
    expect(validateEmployeeDates(joinDate, new Date("2024-06-01"))).toBe(true);
  });

  it("rejects a terminatedDate on or before joinDate", () => {
    expect(validateEmployeeDates(joinDate, new Date("2024-01-15"))).toBe(
      "Terminate date must be after join date!",
    );
    expect(validateEmployeeDates(joinDate, new Date("2023-12-01"))).toBe(
      "Terminate date must be after join date!",
    );
  });
});
