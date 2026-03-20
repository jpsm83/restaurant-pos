/**
 * getOnDutyManagersUserIds - Gets User IDs of on-duty managers
 */

import { Types } from "mongoose";
import Employee from "../models/employee.ts";
import { managementRolesEnums } from "../../../lib/enums.ts";

const getOnDutyManagersUserIds = async (
  businessId: Types.ObjectId,
): Promise<Types.ObjectId[]> => {
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
    if (
      e.userId &&
      managementRolesEnums.some((role) => e.allEmployeeRoles?.includes(role))
    ) {
      ids.push(e.userId);
    }
  }
  return ids;
};

export default getOnDutyManagersUserIds;
