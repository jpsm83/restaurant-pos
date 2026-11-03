/**
 * Resolve the subscription pointer a Business inherits from its Owner.
 *
 * A Business carries no subscription of its own. It reaches the plan through
 * Business → Company → Owner, where the portfolio-level subscription lives.
 * The plan catalogue is Phase 10 work; this read-only lookup lets existing
 * commission estimates use the Owner's plan until then.
 */

import { Types } from "mongoose";

import Business from "../models/business.ts";
import Company from "../models/company.ts";
import Owner from "../models/owner.ts";

export async function resolveBusinessOwnerSubscription(
  businessId: string | Types.ObjectId,
): Promise<string | undefined> {
  const business = (await Business.findById(businessId)
    .select("companyId")
    .lean()) as { companyId?: Types.ObjectId } | null;
  if (!business?.companyId) return undefined;

  const company = (await Company.findById(business.companyId)
    .select("ownerId")
    .lean()) as { ownerId?: Types.ObjectId } | null;
  if (!company?.ownerId) return undefined;

  const owner = (await Owner.findById(company.ownerId)
    .select("subscription")
    .lean()) as { subscription?: string } | null;
  return owner?.subscription;
}
