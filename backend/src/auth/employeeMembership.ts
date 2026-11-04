import type { ClientSession, Types } from "mongoose";
import type { EmploymentStatus } from "restaurant-pos-packages/enums";

import Employee from "../models/employee.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import { usableMembershipFilter } from "../employees/membershipStatus.ts";

const MEMBERSHIP_SELECT = "businessId allEmployeeRoles employmentStatus onDuty";

/** The membership fields the access and session seams consume. */
export interface EmployeeMembership {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  allEmployeeRoles?: string[];
  employmentStatus?: EmploymentStatus;
  onDuty?: boolean;
}

/**
 * The one active-membership filter shared by the single and multi lookups.
 *
 * With a stored employment status, only the employed statuses count; Suspended
 * and Terminated block the membership. A legacy row without a stored status
 * keeps the old rule: `active` is true and there is no `terminatedDate`.
 */
function usableMembershipQuery(params: {
  userId: Types.ObjectId | string;
  businessId?: Types.ObjectId | string;
  employeeId?: Types.ObjectId | string;
}): Record<string, unknown> {
  return withSoftDeleteFilter({
    userId: params.userId,
    ...usableMembershipFilter,
    ...(params.businessId === undefined
      ? {}
      : { businessId: params.businessId }),
    ...(params.employeeId === undefined ? {} : { _id: params.employeeId }),
  });
}

/**
 * Resolve one usable Employee membership for a User.
 *
 * When `businessId` is given the membership is scoped to that venue; when
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
  const { session } = params;

  let query = Employee.findOne(usableMembershipQuery(params))
    .select(MEMBERSHIP_SELECT)
    .sort({ _id: 1 })
    .lean<EmployeeMembership>();
  if (session) query = query.session(session);

  return await query;
}

/** Every usable membership for a User, ordered by id for deterministic scans. */
export async function findUsableEmployeeMemberships(params: {
  userId: Types.ObjectId | string;
  session?: ClientSession;
}): Promise<EmployeeMembership[]> {
  const { session } = params;

  let query = Employee.find(usableMembershipQuery(params))
    .select(MEMBERSHIP_SELECT)
    .sort({ _id: 1 })
    .lean<EmployeeMembership[]>();
  if (session) query = query.session(session);

  return await query;
}
