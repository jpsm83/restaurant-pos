/**
 * canLogAsEmployee — schedule check for employee login
 *
 * Given an employeeId, returns whether that employee is allowed to log in as
 * employee right now: they must be scheduled for today with a shift that
 * covers the current time, allowing login from 5 minutes before shift start.
 * Management roles bypass schedule check entirely.
 */

import Employee from "../models/employee.ts";
import Schedule from "../models/schedule.ts";
import type { Types } from "mongoose";
import * as enums from "../../../packages/enums.ts";

const { managementRolesEnums } = enums;

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface CanLogAsEmployeeResult {
  canLogAsEmployee: boolean;
}

/**
 * Returns { canLogAsEmployee: true } if the employee is scheduled for today
 * and current time is within [shiftStart - 5 min, shiftEnd]. Management roles
 * always return true. Caller must ensure DB is connected before invoking.
 */
export default async function canLogAsEmployee(
  employeeId: Types.ObjectId | string,
  now?: Date,
): Promise<CanLogAsEmployeeResult> {
  const employee = (await Employee.findById(employeeId)
    .select("businessId active terminatedDate allEmployeeRoles")
    .lean()) as {
    businessId: unknown;
    active?: boolean;
    terminatedDate?: unknown;
    allEmployeeRoles?: unknown;
  } | null;

  if (!employee || !employee.active || employee.terminatedDate) {
    return { canLogAsEmployee: false };
  }

  const roles =
    Array.isArray(employee.allEmployeeRoles) && employee.allEmployeeRoles.length
      ? (employee.allEmployeeRoles as unknown[]).map((role) => String(role))
      : [];
  if (managementRolesEnums.some((role) => roles.includes(role))) {
    return { canLogAsEmployee: true };
  }

  const effectiveNow = now ?? new Date();
  const startOfDay = new Date(effectiveNow);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const schedule = (await Schedule.findOne({
    businessId: employee.businessId,
    date: { $gte: startOfDay, $lt: endOfDay },
  })
    .select("employeesSchedules")
    .lean()) as {
    employeesSchedules?: Array<{
      employeeId: unknown;
      vacation?: boolean;
      timeRange: { startTime: Date; endTime: Date };
    }>;
  } | null;

  if (!schedule?.employeesSchedules?.length) {
    return { canLogAsEmployee: false };
  }

  const employeeIdStr =
    typeof employeeId === "string" ? employeeId : employeeId.toString();
  for (const entry of schedule.employeesSchedules) {
    if (entry.vacation) continue;
    const entryEmployeeId =
      typeof entry.employeeId === "object" && entry.employeeId !== null
        ? ((entry.employeeId as { toString?: () => string }).toString?.() ??
          String(entry.employeeId))
        : String(entry.employeeId);
    if (entryEmployeeId !== employeeIdStr) continue;

    const start = new Date(entry.timeRange.startTime).getTime();
    const end = new Date(entry.timeRange.endTime).getTime();
    const windowStart = start - FIVE_MINUTES_MS;
    if (
      effectiveNow.getTime() >= windowStart &&
      effectiveNow.getTime() <= end
    ) {
      return { canLogAsEmployee: true };
    }
  }

  return { canLogAsEmployee: false };
}
