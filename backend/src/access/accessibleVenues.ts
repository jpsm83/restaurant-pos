/**
 * The signed-in User's accessible venue list.
 *
 * The list is the union of the Businesses in the caller's Owner/Company
 * portfolio and every usable Employee membership. Each item is projected by
 * `resolveEffectiveAccess`, so this read never grows a second eligibility
 * rule: ownership wins over a membership at the same venue, blocked
 * memberships disappear, and schedule-gated memberships stay listed with
 * `canEnterBusiness` false. Ordering is deterministic — owned venues first,
 * then member venues, each by trade name and then id.
 */

import { Types } from "mongoose";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";

import Business from "../models/business.ts";
import Company from "../models/company.ts";
import Employee from "../models/employee.ts";
import Owner from "../models/owner.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import { usableMembershipFilter } from "../employees/membershipStatus.ts";
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
} from "./resolveEffectiveAccess.ts";

interface BusinessIdentity {
  _id: Types.ObjectId;
  tradeName: string;
}

function compareVenues(
  left: IAuthAccessibleVenue,
  right: IAuthAccessibleVenue,
): number {
  if (left.tradeName !== right.tradeName) {
    return left.tradeName < right.tradeName ? -1 : 1;
  }
  if (left.businessId === right.businessId) return 0;
  return left.businessId < right.businessId ? -1 : 1;
}

async function findOwnedBusinesses(userId: string): Promise<BusinessIdentity[]> {
  const owner = (await Owner.findOne({ userId }).select("_id").lean()) as {
    _id: Types.ObjectId;
  } | null;
  if (!owner) return [];

  const companies = (await Company.find(
    withSoftDeleteFilter({ ownerId: owner._id }),
  )
    .select("_id")
    .lean()) as Array<{ _id: Types.ObjectId }>;
  if (!companies.length) return [];

  return (await Business.find({
    companyId: { $in: companies.map((company) => company._id) },
  })
    .select("_id tradeName")
    .lean()) as BusinessIdentity[];
}

async function findMemberBusinessIds(userId: string): Promise<string[]> {
  const memberships = (await Employee.find(
    withSoftDeleteFilter({
      userId,
      ...usableMembershipFilter,
    }),
  )
    .select("businessId")
    .lean()) as Array<{ businessId: Types.ObjectId }>;

  return [...new Set(memberships.map((row) => String(row.businessId)))];
}

async function findBusinessTradeNames(
  businessIds: string[],
): Promise<Map<string, string>> {
  if (!businessIds.length) return new Map();

  const businesses = (await Business.find({ _id: { $in: businessIds } })
    .select("_id tradeName")
    .lean()) as BusinessIdentity[];

  return new Map(
    businesses.map((business) => [String(business._id), business.tradeName]),
  );
}

type OwnedAccess = EffectiveAccess & { source: "ownership" };
type MemberAccess = EffectiveAccess & { source: "membership" };

function isOwnedAccess(access: EffectiveAccess | null): access is OwnedAccess {
  return access?.source === "ownership";
}

function isMemberAccess(access: EffectiveAccess | null): access is MemberAccess {
  return access?.source === "membership";
}

function toAccessibleVenue(
  access: OwnedAccess | MemberAccess,
  tradeName: string,
): IAuthAccessibleVenue {
  return {
    businessId: access.businessId,
    tradeName,
    source: access.source,
    effectiveLayer: access.effectiveLayer,
    jobRoles: access.jobRoles,
    capabilities: access.capabilities,
    canEnterBusiness: access.canEnterBusiness,
  };
}

/**
 * Reads the caller's accessible venues. An invalid User id, or a User with
 * neither ownership nor a usable membership, gets an empty list.
 */
export async function readAccessibleVenues(params: {
  userId: string;
  now?: Date;
}): Promise<IAuthAccessibleVenue[]> {
  const { userId } = params;
  if (!Types.ObjectId.isValid(userId)) return [];

  const now = params.now ?? new Date();
  const ownedBusinesses = await findOwnedBusinesses(userId);
  const ownedIds = new Set(
    ownedBusinesses.map((business) => String(business._id)),
  );

  const memberBusinessIds = (await findMemberBusinessIds(userId)).filter(
    (businessId) => !ownedIds.has(businessId),
  );
  const memberBusinessNames = await findBusinessTradeNames(memberBusinessIds);

  const owned: IAuthAccessibleVenue[] = [];
  for (const business of ownedBusinesses) {
    const access = await resolveEffectiveAccess({
      userId,
      businessId: String(business._id),
      now,
    });
    if (!isOwnedAccess(access)) continue;
    owned.push(toAccessibleVenue(access, business.tradeName));
  }

  const member: IAuthAccessibleVenue[] = [];
  for (const businessId of memberBusinessIds) {
    const tradeName = memberBusinessNames.get(businessId);
    if (!tradeName) continue;

    const access = await resolveEffectiveAccess({ userId, businessId, now });
    if (!isMemberAccess(access)) continue;
    member.push(toAccessibleVenue(access, tradeName));
  }

  return [...owned.sort(compareVenues), ...member.sort(compareVenues)];
}
