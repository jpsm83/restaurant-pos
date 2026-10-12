/**
 * Employee post-parse helper tests — the cross-field date rule the DTO cannot
 * express.
 */

import { describe, it, expect } from "vitest";

import validateEmployeeDates from "../../src/employees/validateEmployeeDates.ts";

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
