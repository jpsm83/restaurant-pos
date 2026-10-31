/**
 * Unit tests for `employeeModeSchedule.ts` — window math and `deriveEmployeeModeFromSchedule`
 * (no mocks; pure functions).
 */
import { describe, expect, it, vi } from "vitest";
import {
  deriveEmployeeModeFromSchedule,
  EMPLOYEE_LOGIN_EARLY_MS,
  EMPLOYEE_LOGIN_LATE_MS,
  isWithinEmployeeLoginWindow,
} from "../employeeModeSchedule";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe("isWithinEmployeeLoginWindow", () => {
  it("allows the ten-minutes-before planned-start boundary and refuses one millisecond earlier", () => {
    const start = 10 * HOUR;
    expect(
      isWithinEmployeeLoginWindow(
        start - EMPLOYEE_LOGIN_EARLY_MS - 1,
        start,
      ),
    ).toBe(false);
    expect(
      isWithinEmployeeLoginWindow(start - EMPLOYEE_LOGIN_EARLY_MS, start),
    ).toBe(true);
  });

  it("refuses after the two-hours-after planned-start boundary", () => {
    const start = 10 * HOUR;
    expect(
      isWithinEmployeeLoginWindow(start + EMPLOYEE_LOGIN_LATE_MS, start),
    ).toBe(true);
    expect(
      isWithinEmployeeLoginWindow(start + EMPLOYEE_LOGIN_LATE_MS + 1, start),
    ).toBe(false);
  });

});

describe("deriveEmployeeModeFromSchedule", () => {
  it("ignores vacation rows", () => {
    const now = 12 * HOUR;
    const start = new Date(now + HOUR).toISOString();
    const end = new Date(now + 5 * HOUR).toISOString();
    const d = deriveEmployeeModeFromSchedule(now, [
      { vacation: true, startTime: start, endTime: end },
    ]);
    expect(d.scheduleAllowsEmployeeNow).toBe(false);
    expect(d.countdownTargetMs).toBe(null);
  });

  it("returns the planned-start-minus-ten-minutes countdown target", () => {
    const shiftStart = 14 * HOUR;
    const shiftEnd = 22 * HOUR;
    const now = shiftStart - EMPLOYEE_LOGIN_EARLY_MS - 30 * MINUTE;
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

  it("marks scheduleAllowsEmployeeNow when inside the window", () => {
    const shiftStart = 8 * HOUR;
    const shiftEnd = 16 * HOUR;
    const now = shiftStart + MINUTE;
    const d = deriveEmployeeModeFromSchedule(now, [
      {
        vacation: false,
        startTime: new Date(shiftStart).toISOString(),
        endTime: new Date(shiftEnd).toISOString(),
      },
    ]);
    expect(d.scheduleAllowsEmployeeNow).toBe(true);
  });

  it("stays allowed after shift end while still within two hours of planned start", () => {
    const shiftStart = 8 * HOUR;
    const shiftEnd = shiftStart + 30 * MINUTE;
    const now = shiftEnd + HOUR;
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
      const shiftStart = frozen + 4 * HOUR;
      const shiftEnd = frozen + 12 * HOUR;
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
