import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Employee from "@/lib/db/models/employee";
import { hasManagementRole } from "@/lib/constants";

export async function getOnDutyManagersUserIds(
  businessId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  await connectDb();

  const employees = (await Employee.find({
    businessId,
    onDuty: true,
  })
    .select("userId allEmployeeRoles")
    .lean()) as unknown as { userId?: Types.ObjectId; allEmployeeRoles?: string[] }[];

  const ids: Types.ObjectId[] = [];
  for (const e of employees) {
    if (e.userId && hasManagementRole(e.allEmployeeRoles)) {
      ids.push(e.userId);
    }
  }
  return ids;
}

