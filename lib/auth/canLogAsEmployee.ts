/**
 * canLogAsEmployee — schedule check for employee login
 *
 * Given an employeeId, returns whether that employee is allowed to log in as
 * employee right now: they must be scheduled for today with a shift that
 * covers the current time, allowing login from 5 minutes before shift start.
 * Used by NextAuth authorize() when building the user session.
 */

import Employee from "@/lib/db/models/employee";
import Schedule from "@/lib/db/models/schedule";
import { hasManagementRole } from "@/lib/constants";
import type { Types } from "mongoose";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface CanLogAsEmployeeResult {
  canLogAsEmployee: boolean;
}

/**
 * Returns { canLogAsEmployee: true } if the employee is scheduled for today
 * and current time is within [shiftStart - 5 min, shiftEnd]. Caller must
 * ensure connectDb() has been called before invoking this.
 */
export async function canLogAsEmployee(
  employeeId: Types.ObjectId
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
  if (hasManagementRole(roles)) {
    return { canLogAsEmployee: true };
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const schedule = (await Schedule.findOne({
    businessId: employee.businessId,
    date: { $gte: startOfDay, $lt: endOfDay },
  })
    .select("employeesSchedules")
    .lean()) as { employeesSchedules?: Array<{ employeeId: unknown; vacation?: boolean; timeRange: { startTime: Date; endTime: Date } }> } | null;

  if (!schedule?.employeesSchedules?.length) {
    return { canLogAsEmployee: false };
  }

  const employeeIdStr = employeeId.toString();
  for (const entry of schedule.employeesSchedules) {
    if (entry.vacation) continue;
    const entryEmployeeId =
      typeof entry.employeeId === "object" && entry.employeeId !== null
        ? (entry.employeeId as { toString?: () => string }).toString?.() ??
          String(entry.employeeId)
        : String(entry.employeeId);
    if (entryEmployeeId !== employeeIdStr) continue;

    const start = new Date(entry.timeRange.startTime).getTime();
    const end = new Date(entry.timeRange.endTime).getTime();
    const windowStart = start - FIVE_MINUTES_MS;
    if (now.getTime() >= windowStart && now.getTime() <= end) {
      return { canLogAsEmployee: true };
    }
  }

  return { canLogAsEmployee: false };
}
