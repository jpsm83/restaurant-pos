/**
 * getOnDutyManagersUserIds - Gets User IDs of on-duty managers
 */

import { Types } from "mongoose";
import Employee from "../models/employee.ts";
import { hasManagementRole } from "../utils/constants.ts";

export async function getOnDutyManagersUserIds(
  businessId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  const employees = (await Employee.find({
    businessId,
    onDuty: true,
  })
    .select("userId allEmployeeRoles")
    .lean()) as unknown as {
    userId?: Types.ObjectId;
    allEmployeeRoles?: string[];
  }[];

  const ids: Types.ObjectId[] = [];
  for (const e of employees) {
    if (e.userId && hasManagementRole(e.allEmployeeRoles)) {
      ids.push(e.userId);
    }
  }
  return ids;
}
