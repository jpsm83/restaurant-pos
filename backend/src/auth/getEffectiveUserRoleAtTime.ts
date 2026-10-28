import type { ClientSession, Types } from "mongoose";

import canLogAsEmployee from "./canLogAsEmployee.ts";
import findActiveEmployeeMembership from "./employeeMembership.ts";

export type EffectiveUserRole = "employee" | "customer";

/**
 * Resolves "employee vs customer at that time" for a given user + business.
 *
 * Rules (single source of truth):
 * - Resolve the active Employee membership for that User and Business
 *   - No active membership => "customer"
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

  const employee = await findActiveEmployeeMembership({
    userId,
    businessId,
    session,
  });

  if (!employee || employee.onDuty !== true) {
    return "customer";
  }

  const { canLogAsEmployee: scheduleAllowed } = await canLogAsEmployee(
    employee._id,
    effectiveNow,
    session,
  );

  return scheduleAllowed === true ? "employee" : "customer";
}
