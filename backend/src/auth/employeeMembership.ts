import type { ClientSession, Types } from "mongoose";
import { activeEmploymentStatusEnums } from "restaurant-pos-packages/enums";

import Employee from "../models/employee.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";

export interface EmployeeMembership {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  allEmployeeRoles?: string[];
  employmentStatus?: string;
  onDuty?: boolean;
}

/**
 * Resolve one usable Employee membership for a User.
 *
 * With a stored employment status, only the employed statuses count; Suspended
 * and Terminated block the membership. A legacy row without a stored status
 * keeps the old rule: `active` is true and there is no `terminatedDate`. When
 * `businessId` is given the membership is scoped to that venue; when
 * `employeeId` is given that exact membership is resolved. Otherwise the first
 * usable membership by id is returned so single-membership sign-in stays
 * deterministic.
 */
export default async function findActiveEmployeeMembership(params: {
  userId: Types.ObjectId | string;
  businessId?: Types.ObjectId | string;
  employeeId?: Types.ObjectId | string;
  session?: ClientSession;
}): Promise<EmployeeMembership | null> {
  const { userId, businessId, employeeId, session } = params;

  let query = Employee.findOne(
    withSoftDeleteFilter({
      userId,
      $or: [
        { employmentStatus: { $in: activeEmploymentStatusEnums } },
        {
          employmentStatus: null,
          active: true,
          terminatedDate: null,
        },
      ],
      ...(businessId === undefined ? {} : { businessId }),
      ...(employeeId === undefined ? {} : { _id: employeeId }),
    }),
  )
    .select("businessId allEmployeeRoles employmentStatus onDuty")
    .sort({ _id: 1 })
    .lean();
  if (session) query = query.session(session);

  return (await query) as EmployeeMembership | null;
}
