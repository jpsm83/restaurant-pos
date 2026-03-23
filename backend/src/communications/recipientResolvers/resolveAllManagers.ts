import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import Employee from "../../models/employee.ts";
import * as enums from "../../../../lib/enums.ts";
import { toUniqueObjectIds } from "./utils.ts";

const { managementRolesEnums } = enums;

const resolveAllManagers = async (
  businessId: Types.ObjectId,
  session?: ClientSession
): Promise<{ employeeIds: Types.ObjectId[]; userIds: Types.ObjectId[] }> => {
  const managers = await Employee.find({
    businessId,
    currentShiftRole: { $in: managementRolesEnums },
  })
    .select("_id userId")
    .lean()
    .session(session ?? null);

  return {
    employeeIds: toUniqueObjectIds(managers.map((manager) => manager._id)),
    userIds: toUniqueObjectIds(managers.map((manager) => manager.userId)),
  };
};

export default resolveAllManagers;

