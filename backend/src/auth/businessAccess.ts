/**
 * One seam for resolving a signed-in User's access to a specific Business.
 *
 * A User may act on a venue when they own it through
 * User → Owner → Company → Business, or when they hold an active Employee
 * membership for that venue. Access layers and capabilities refine this later.
 */

import { Types } from "mongoose";

import Business from "../models/business.ts";
import Company from "../models/company.ts";
import Owner from "../models/owner.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import findActiveEmployeeMembership from "./employeeMembership.ts";

export type BusinessAccessKind = "owner" | "employee";

export async function resolveBusinessAccess(
  userId: string,
  businessId: string,
): Promise<BusinessAccessKind | null> {
  if (
    !Types.ObjectId.isValid(userId) ||
    !Types.ObjectId.isValid(businessId)
  ) {
    return null;
  }

  const business = (await Business.findById(businessId)
    .select("companyId")
    .lean()) as { companyId?: Types.ObjectId } | null;
  if (!business) return null;

  if (business.companyId) {
    const owner = (await Owner.findOne({ userId })
      .select("_id")
      .lean()) as { _id: unknown } | null;
    if (owner) {
      const company = await Company.findOne(
        withSoftDeleteFilter({
          _id: business.companyId,
          ownerId: owner._id,
        }),
      )
        .select("_id")
        .lean();
      if (company) return "owner";
    }
  }

  const employee = await findActiveEmployeeMembership({
    userId,
    businessId,
  });
  return employee ? "employee" : null;
}

export async function canAccessBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  return (await resolveBusinessAccess(userId, businessId)) !== null;
}
