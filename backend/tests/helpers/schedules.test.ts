/**
 * Schedule Helpers Tests - Task 0.7
 * Tests for calculateEmployeeCost, employeesValidation, isScheduleOverlapping
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { calculateEmployeeCost } from "../../src/schedules/calculateEmployeeCost.ts";
import { employeesValidation } from "../../src/schedules/employeesValidation.ts";
import { isScheduleOverlapping } from "../../src/schedules/isScheduleOverlapping.ts";

describe("Schedule Helpers", () => {
  describe("calculateEmployeeCost", () => {
    it("calculates monthly salary correctly", () => {
      const salary = { payFrequency: "Monthly" as const, grossSalary: 3000, netSalary: 2400 };
      const shiftDurationMs = 8 * 3600000; // 8 hours
      const weekdaysInMonth = 22;

      const result = calculateEmployeeCost(salary, shiftDurationMs, weekdaysInMonth);
      expect(result).toBeCloseTo(3000 / 22, 2);
    });

    it("calculates weekly salary correctly", () => {
      const salary = { payFrequency: "Weekly" as const, grossSalary: 750, netSalary: 600 };
      const shiftDurationMs = 8 * 3600000;
      const weekdaysInMonth = 22;

      const result = calculateEmployeeCost(salary, shiftDurationMs, weekdaysInMonth);
      expect(result).toBeCloseTo(750 / 5, 2); // Weekly divided by 5 days
    });

    it("calculates daily salary correctly", () => {
      const salary = { payFrequency: "Daily" as const, grossSalary: 150, netSalary: 120 };
      const shiftDurationMs = 8 * 3600000;
      const weekdaysInMonth = 22;

      const result = calculateEmployeeCost(salary, shiftDurationMs, weekdaysInMonth);
      expect(result).toBe(150); // Full daily rate
    });

    it("calculates hourly salary correctly", () => {
      const salary = { payFrequency: "Hourly" as const, grossSalary: 20, netSalary: 16 };
      const shiftDurationMs = 8 * 3600000; // 8 hours
      const weekdaysInMonth = 22;

      const result = calculateEmployeeCost(salary, shiftDurationMs, weekdaysInMonth);
      expect(result).toBe(20 * 8); // Hourly rate * hours
    });

    it("handles different shift durations for hourly", () => {
      const salary = { payFrequency: "Hourly" as const, grossSalary: 15, netSalary: 12 };
      const shiftDurationMs = 4 * 3600000; // 4 hours
      const weekdaysInMonth = 22;

      const result = calculateEmployeeCost(salary, shiftDurationMs, weekdaysInMonth);
      expect(result).toBe(15 * 4); // 60
    });
  });

  describe("employeesValidation", () => {
    const validEmployee = {
      employeeId: new Types.ObjectId(),
      role: "Waiter",
      timeRange: {
        startTime: new Date("2025-01-15T09:00:00"),
        endTime: new Date("2025-01-15T17:00:00"),
      },
    };

    it("returns true for valid employee data", () => {
      expect(employeesValidation(validEmployee as any)).toBe(true);
    });

    it("returns true for valid employee with vacation", () => {
      const employeeWithVacation = {
        ...validEmployee,
        vacation: true,
      };
      expect(employeesValidation(employeeWithVacation as any)).toBe(true);
    });

    it("returns error for undefined employee", () => {
      expect(employeesValidation(undefined as any)).toBe("Invalid employee object");
    });

    it("returns error for missing employeeId", () => {
      const invalid = { role: "Waiter", timeRange: validEmployee.timeRange };
      expect(employeesValidation(invalid as any)).toBe("employeeId must have a value!");
    });

    it("returns error for missing role", () => {
      const invalid = { employeeId: new Types.ObjectId(), timeRange: validEmployee.timeRange };
      expect(employeesValidation(invalid as any)).toBe("role must have a value!");
    });

    it("returns error for missing timeRange", () => {
      const invalid = { employeeId: new Types.ObjectId(), role: "Waiter" };
      expect(employeesValidation(invalid as any)).toBe("timeRange must have a value!");
    });

    it("returns error for invalid key", () => {
      const invalid = { ...validEmployee, invalidKey: "test" };
      expect(employeesValidation(invalid as any)).toBe("Invalid key: invalidKey");
    });

    it("returns error for invalid timeRange (startTime after endTime)", () => {
      const invalid = {
        employeeId: new Types.ObjectId(),
        role: "Waiter",
        timeRange: {
          startTime: new Date("2025-01-15T17:00:00"),
          endTime: new Date("2025-01-15T09:00:00"), // before start
        },
      };
      expect(employeesValidation(invalid as any)).toBe("Invalid timeRange object");
    });

    it("returns error for missing startTime", () => {
      const invalid = {
        employeeId: new Types.ObjectId(),
        role: "Waiter",
        timeRange: {
          endTime: new Date("2025-01-15T17:00:00"),
        },
      };
      expect(employeesValidation(invalid as any)).toBe("Invalid timeRange object");
    });
  });

  describe("isScheduleOverlapping", () => {
    const existingSchedules = [
      {
        startTime: new Date("2025-01-15T09:00:00"),
        endTime: new Date("2025-01-15T13:00:00"),
      },
      {
        startTime: new Date("2025-01-15T14:00:00"),
        endTime: new Date("2025-01-15T18:00:00"),
      },
    ];

    it("returns false when no overlap", () => {
      const newStart = new Date("2025-01-15T19:00:00");
      const newEnd = new Date("2025-01-15T22:00:00");

      expect(isScheduleOverlapping(newStart, newEnd, existingSchedules)).toBe(false);
    });

    it("returns false for gap between schedules", () => {
      const newStart = new Date("2025-01-15T13:00:01");
      const newEnd = new Date("2025-01-15T13:59:59");

      expect(isScheduleOverlapping(newStart, newEnd, existingSchedules)).toBe(false);
    });

    it("returns true when start time overlaps", () => {
      const newStart = new Date("2025-01-15T12:00:00"); // overlaps with first schedule
      const newEnd = new Date("2025-01-15T15:00:00");

      expect(isScheduleOverlapping(newStart, newEnd, existingSchedules)).toBe(true);
    });

    it("returns true when end time overlaps", () => {
      const newStart = new Date("2025-01-15T07:00:00");
      const newEnd = new Date("2025-01-15T10:00:00"); // overlaps with first schedule

      expect(isScheduleOverlapping(newStart, newEnd, existingSchedules)).toBe(true);
    });

    it("returns true when completely within existing schedule", () => {
      const newStart = new Date("2025-01-15T10:00:00");
      const newEnd = new Date("2025-01-15T12:00:00");

      expect(isScheduleOverlapping(newStart, newEnd, existingSchedules)).toBe(true);
    });

    it("returns false for empty existing schedules", () => {
      const newStart = new Date("2025-01-15T09:00:00");
      const newEnd = new Date("2025-01-15T17:00:00");

      expect(isScheduleOverlapping(newStart, newEnd, [])).toBe(false);
    });

    it("detects overlap at exact boundary", () => {
      const newStart = new Date("2025-01-15T13:00:00"); // exactly at end of first
      const newEnd = new Date("2025-01-15T14:00:00");

      expect(isScheduleOverlapping(newStart, newEnd, existingSchedules)).toBe(true);
    });
  });
});
