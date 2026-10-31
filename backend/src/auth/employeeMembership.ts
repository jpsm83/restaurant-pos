import type { ClientSession, Types } from "mongoose";

import Employee from "../models/employee.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";

export interface EmployeeMembership {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  allEmployeeRoles?: string[];
  onDuty?: boolean;
}

/**
 * Resolve one active Employee membership for a User.
 *
 * A membership is active when the Employee row is not soft-deleted, `active`
 * is true, and it has no `terminatedDate`. When `businessId` is given the
 * membership is scoped to that venue; when `employeeId` is given that exact
 * membership is resolved. Otherwise the first active membership by id is
 * returned so single-membership sign-in stays deterministic.
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
      active: true,
      terminatedDate: null,
      ...(businessId === undefined ? {} : { businessId }),
      ...(employeeId === undefined ? {} : { _id: employeeId }),
    }),
  )
    .select("businessId allEmployeeRoles onDuty")
    .sort({ _id: 1 })
    .lean();
  if (session) query = query.session(session);

  return (await query) as EmployeeMembership | null;
}
