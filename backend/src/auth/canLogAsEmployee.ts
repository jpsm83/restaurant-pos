/**
 * canLogAsEmployee — effective-layer eligibility for employee login
 *
 * Given an employeeId, returns whether that membership may enter Business mode
 * right now. Eligibility is resolved by `resolveEffectiveAccess`, the same seam
 * behind the per-venue access read: an owning User, manager, or admin is always
 * eligible; supervisor and employee layers are eligible only inside a planned
 * shift's entry window (ten minutes before planned start through two hours
 * after planned start, ignoring shift end and vacation rows).
 *
 * `canUseBusinessMode` applies the same rules to a User without a linked
 * membership, or whose linked membership belongs to an owned venue.
 */

import { Types, type ClientSession } from "mongoose";

import Employee from "../models/employee.ts";
import {
  canEnterBusinessAnywhere,
  resolveEffectiveAccess,
} from "../access/resolveEffectiveAccess.ts";

export interface CanLogAsEmployeeResult {
  canLogAsEmployee: boolean;
}

/**
 * Returns { canLogAsEmployee: true } when the employee's User has an enterable
 * effective layer at the membership's Business. An owning User stays eligible
 * even when the linked membership is inactive; a non-owner's inactive or
 * terminated membership resolves as customer-only. Caller must ensure DB is
 * connected before invoking.
 */
export default async function canLogAsEmployee(
  employeeId: Types.ObjectId | string,
  now?: Date,
  session?: ClientSession,
): Promise<CanLogAsEmployeeResult> {
  let employeeQuery = Employee.findById(employeeId)
    .select("businessId userId")
    .lean();
  if (session) employeeQuery = employeeQuery.session(session);
  const employee = (await employeeQuery) as {
    businessId: unknown;
    userId: unknown;
  } | null;

  if (!employee) return { canLogAsEmployee: false };

  const access = await resolveEffectiveAccess({
    userId: String(employee.userId),
    businessId: String(employee.businessId),
    membershipId: employeeId,
    now,
    session,
  });

  return { canLogAsEmployee: access?.canEnterBusiness === true };
}

/**
 * The Customer | Business mode switch for a User. Ownership and manager/admin
 * layers are always enterable; supervisor and employee layers follow the
 * shared planned-shift entry window. Venue ownership and membership selection
 * stay inside the access resolver so the mode gate and access read agree.
 */
export async function canUseBusinessMode(
  userId: Types.ObjectId | string,
  now?: Date,
): Promise<boolean> {
  return canEnterBusinessAnywhere({ userId: String(userId), now });
}
