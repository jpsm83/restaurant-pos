import type { Types } from "mongoose";

import User from "../models/user.ts";
import Employee from "../models/employee.ts";
import canLogAsEmployee from "./canLogAsEmployee.ts";

export type EffectiveUserRole = "employee" | "customer";

/**
 * Resolves "employee vs customer at that time" for a given user + business.
 *
 * Rules (single source of truth):
 * - If `User.employeeDetails` is missing => "customer"
 * - Load `Employee` from `User.employeeDetails`
 *   - If tenant mismatch (`Employee.businessId !== businessId`) => "customer"
 * - `scheduleAllowed` is computed via `canLogAsEmployee(employeeId, now)`
 * - Final rule: return "employee" only when `scheduleAllowed && Employee.onDuty`
 */
export default async function getEffectiveUserRoleAtTime(params: {
  userId: Types.ObjectId | string;
  businessId: Types.ObjectId | string;
  now?: Date;
}): Promise<EffectiveUserRole> {
  const { userId, businessId, now } = params;
  const effectiveNow = now ?? new Date();

  const user = (await User.findById(userId)
    .select("employeeDetails")
    .lean()) as { employeeDetails?: Types.ObjectId } | null;

  if (!user?.employeeDetails) return "customer";

  const employee = (await Employee.findById(user.employeeDetails)
    .select("businessId onDuty")
    .lean()) as
    | { businessId?: Types.ObjectId; onDuty?: boolean }
    | null;

  if (!employee?.businessId || employee.onDuty !== true) {
    return "customer";
  }

  if (String(employee.businessId) !== String(businessId)) {
    return "customer";
  }

  const { canLogAsEmployee: scheduleAllowed } = await canLogAsEmployee(
    user.employeeDetails,
    effectiveNow
  );

  return scheduleAllowed === true ? "employee" : "customer";
}

