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
import findActiveEmployeeMembership from "./employeeMembership.ts";

export async function canAccessBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  if (
    !Types.ObjectId.isValid(userId) ||
    !Types.ObjectId.isValid(businessId)
  ) {
    return false;
  }

  const business = (await Business.findById(businessId)
    .select("companyId")
    .lean()) as { companyId?: Types.ObjectId } | null;
  if (!business) return false;

  if (business.companyId) {
    const owner = (await Owner.findOne({ userId })
      .select("_id")
      .lean()) as { _id: unknown } | null;
    if (owner) {
      const company = await Company.exists({
        _id: business.companyId,
        ownerId: owner._id,
      });
      if (company) return true;
    }
  }

  const employee = await findActiveEmployeeMembership({
    userId,
    businessId,
  });
  return employee !== null;
}
