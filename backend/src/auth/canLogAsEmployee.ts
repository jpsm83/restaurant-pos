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
import Business from "../models/business.ts";
import Company from "../models/company.ts";
import Owner from "../models/owner.ts";
import { resolveEffectiveAccess } from "../access/resolveEffectiveAccess.ts";
import findActiveEmployeeMembership from "./employeeMembership.ts";

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
    now,
    session,
  });

  return { canLogAsEmployee: access?.canEnterBusiness === true };
}

/**
 * The single eligibility seam behind the Customer | Business mode switch.
 *
 * A User may enter Business mode when they own a venue through
 * User → Owner → Company → Business, or when their active Employee membership
 * resolves to an enterable effective layer. Ownership and manager/admin layers
 * are always enterable; supervisor and employee layers follow the shared
 * planned-shift entry window.
 */
export async function canUseBusinessMode(
  userId: Types.ObjectId | string,
  now?: Date,
): Promise<boolean> {
  if (await ownsAnyBusiness(userId, now)) return true;

  const employee = await findActiveEmployeeMembership({ userId });
  if (!employee) return false;

  const { canLogAsEmployee: canLog } = await canLogAsEmployee(
    employee._id,
    now,
  );
  return canLog;
}

async function ownsAnyBusiness(
  userId: Types.ObjectId | string,
  now?: Date,
): Promise<boolean> {
  const owner = (await Owner.findOne({ userId })
    .select("_id")
    .lean()) as { _id: unknown } | null;
  if (!owner) return false;

  const companies = (await Company.find({ ownerId: owner._id })
    .select("_id")
    .lean()) as Array<{ _id: unknown }>;
  if (!companies.length) return false;

  const business = (await Business.findOne({
    companyId: { $in: companies.map((company) => company._id) },
  })
    .select("_id")
    .lean()) as { _id: unknown } | null;
  if (!business) return false;

  const access = await resolveEffectiveAccess({
    userId: String(userId),
    businessId: String(business._id),
    now,
  });
  return access?.canEnterBusiness === true;
}
