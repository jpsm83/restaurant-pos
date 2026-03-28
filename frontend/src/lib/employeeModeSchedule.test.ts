/**
 * Unit tests for `employeeModeSchedule.ts` — window math and `deriveEmployeeModeFromSchedule`
 * (no mocks; pure functions).
 */
import { describe, expect, it, vi } from "vitest";
import {
  deriveEmployeeModeFromSchedule,
  EMPLOYEE_LOGIN_EARLY_MS,
  isWithinEmployeeLoginWindow,
} from "./employeeModeSchedule";

describe("isWithinEmployeeLoginWindow", () => {
  it("allows login from five minutes before shift start through shift end", () => {
    const start = 10 * 60 * 60 * 1000;
    const end = 18 * 60 * 60 * 1000;
    const before = start - EMPLOYEE_LOGIN_EARLY_MS - 1;
    const atWindow = start - EMPLOYEE_LOGIN_EARLY_MS;
    const mid = start + 1000;
    const after = end + 1;
    expect(isWithinEmployeeLoginWindow(before, start, end)).toBe(false);
    expect(isWithinEmployeeLoginWindow(atWindow, start, end)).toBe(true);
    expect(isWithinEmployeeLoginWindow(mid, start, end)).toBe(true);
    expect(isWithinEmployeeLoginWindow(end, start, end)).toBe(true);
    expect(isWithinEmployeeLoginWindow(after, start, end)).toBe(false);
  });
});

describe("deriveEmployeeModeFromSchedule", () => {
  it("ignores vacation rows", () => {
    const now = 12 * 60 * 60 * 1000;
    const start = new Date(now + 60 * 60 * 1000).toISOString();
    const end = new Date(now + 5 * 60 * 60 * 1000).toISOString();
    const d = deriveEmployeeModeFromSchedule(now, [
      { vacation: true, startTime: start, endTime: end },
    ]);
    expect(d.scheduleAllowsEmployeeNow).toBe(false);
    expect(d.countdownTargetMs).toBe(null);
  });

  it("returns next countdown target before window opens", () => {
    const shiftStart = 14 * 60 * 60 * 1000;
    const shiftEnd = 22 * 60 * 60 * 1000;
    const now = shiftStart - EMPLOYEE_LOGIN_EARLY_MS - 30 * 60 * 1000;
    const d = deriveEmployeeModeFromSchedule(now, [
      {
        vacation: false,
        startTime: new Date(shiftStart).toISOString(),
        endTime: new Date(shiftEnd).toISOString(),
      },
    ]);
    expect(d.scheduleAllowsEmployeeNow).toBe(false);
    expect(d.countdownTargetMs).toBe(shiftStart - EMPLOYEE_LOGIN_EARLY_MS);
  });

  it("marks scheduleAllowsEmployeeNow when inside window", () => {
    const shiftStart = 8 * 60 * 60 * 1000;
    const shiftEnd = 16 * 60 * 60 * 1000;
    const now = shiftStart + 60 * 1000;
    const d = deriveEmployeeModeFromSchedule(now, [
      {
        vacation: false,
        startTime: new Date(shiftStart).toISOString(),
        endTime: new Date(shiftEnd).toISOString(),
      },
    ]);
    expect(d.scheduleAllowsEmployeeNow).toBe(true);
  });

  it("derives countdown from a fixed clock via Date.now (Phase 3.7.3)", () => {
    const frozen = Date.UTC(2026, 2, 28, 8, 0, 0);
    const spy = vi.spyOn(Date, "now").mockReturnValue(frozen);
    try {
      const shiftStart = frozen + 4 * 60 * 60 * 1000;
      const shiftEnd = frozen + 12 * 60 * 60 * 1000;
      const d = deriveEmployeeModeFromSchedule(Date.now(), [
        {
          vacation: false,
          startTime: new Date(shiftStart).toISOString(),
          endTime: new Date(shiftEnd).toISOString(),
        },
      ]);
      expect(d.scheduleAllowsEmployeeNow).toBe(false);
      expect(d.countdownTargetMs).toBe(shiftStart - EMPLOYEE_LOGIN_EARLY_MS);
    } finally {
      spy.mockRestore();
    }
  });
});
