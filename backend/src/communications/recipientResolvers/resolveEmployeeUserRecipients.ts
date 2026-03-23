import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import Employee from "../../models/employee.ts";
import { toUniqueObjectIds } from "./utils.ts";

export interface EmployeeRecipientResolution {
  employeeIds: Types.ObjectId[];
  employeeUserIds: Types.ObjectId[];
}

const resolveEmployeeUserRecipients = async (input: {
  employeeIds?: (Types.ObjectId | string)[];
  employeeUserIds?: (Types.ObjectId | string)[];
  session?: ClientSession;
}): Promise<EmployeeRecipientResolution> => {
  const employeeIds = toUniqueObjectIds(input.employeeIds ?? []);
  const directEmployeeUserIds = toUniqueObjectIds(input.employeeUserIds ?? []);

  if (employeeIds.length === 0) {
    return {
      employeeIds,
      employeeUserIds: directEmployeeUserIds,
    };
  }

  const employeeDocs = await Employee.find({ _id: { $in: employeeIds } })
    .select("userId")
    .lean()
    .session(input.session ?? null);

  const mappedEmployeeUserIds = toUniqueObjectIds(
    employeeDocs.map((employee) => employee.userId)
  );

  return {
    employeeIds,
    employeeUserIds: toUniqueObjectIds([
      ...directEmployeeUserIds,
      ...mappedEmployeeUserIds,
    ]),
  };
};

export default resolveEmployeeUserRecipients;

