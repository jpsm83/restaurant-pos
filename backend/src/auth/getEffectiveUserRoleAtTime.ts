import type { ClientSession, Types } from "mongoose";

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
 * - `scheduleAllowed` is computed via `canLogAsEmployee(employeeId, now, session?)`
 * - Final rule: return "employee" only when `scheduleAllowed && Employee.onDuty`
 */
export default async function getEffectiveUserRoleAtTime(params: {
  userId: Types.ObjectId | string;
  businessId: Types.ObjectId | string;
  now?: Date;
  /** When set, all reads participate in this MongoDB transaction session. */
  session?: ClientSession;
}): Promise<EffectiveUserRole> {
  const { userId, businessId, now, session } = params;
  const effectiveNow = now ?? new Date();

  let userQuery = User.findById(userId).select("employeeDetails").lean();
  if (session) userQuery = userQuery.session(session);
  const user = (await userQuery) as { employeeDetails?: Types.ObjectId } | null;

  if (!user?.employeeDetails) return "customer";

  let employeeQuery = Employee.findById(user.employeeDetails)
    .select("businessId onDuty")
    .lean();
  if (session) employeeQuery = employeeQuery.session(session);
  const employee = (await employeeQuery) as
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
    effectiveNow,
    session,
  );

  return scheduleAllowed === true ? "employee" : "customer";
}

