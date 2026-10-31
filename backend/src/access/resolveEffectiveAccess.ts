/**
 * Resolve one signed-in User's effective access at one Business.
 *
 * Ownership is User → Owner → Company → Business and always wins over a
 * membership: an owning User is admin-equivalent with source ownership, even
 * when they also hold an Employee membership. Otherwise an active membership
 * resolves to the highest default layer among its job roles. No ownership and
 * no active membership resolves to customer-only with source `none`.
 *
 * This stands the access facts up without reading per-shift fields
 * (`currentShiftRole`, `onDuty`); per-shift layer flips arrive with attendance
 * sessions. Business entry follows the layer rule: ownership, manager, and
 * admin always; supervisor and employee only inside a planned shift's
 * ten-minutes-before to two-hours-after planned-start window.
 */

import { Types, type ClientSession } from "mongoose";

import {
  getDefaultCapabilities,
  resolveDefaultAccessLayerForRoles,
  type AccessCapabilityKey,
  type AccessLayer,
} from "restaurant-pos-packages/access";
import Business from "../models/business.ts";
import Company from "../models/company.ts";
import Owner from "../models/owner.ts";
import Schedule from "../models/schedule.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import findActiveEmployeeMembership, {
  type EmployeeMembership,
} from "../auth/employeeMembership.ts";

const ENTRY_WINDOW_BEFORE_START_MS = 10 * 60 * 1000;
const ENTRY_WINDOW_AFTER_START_MS = 2 * 60 * 60 * 1000;

export type EffectiveAccessSource = "ownership" | "membership" | "none";

export interface EffectiveAccess {
  businessId: string;
  effectiveLayer: AccessLayer;
  source: EffectiveAccessSource;
  /** The membership's job roles; empty for ownership-only access. */
  jobRoles: string[];
  /** Active capability keys in catalogue order. */
  capabilities: AccessCapabilityKey[];
  canEnterBusiness: boolean;
}

/** The User, venue, instant, and optional transaction one lookup runs inside. */
interface AccessLookup {
  userId: string;
  businessId: string;
  now: Date;
  session?: ClientSession;
}

export interface ResolveEffectiveAccessParams {
  userId: string;
  businessId: string;
  now?: Date;
  /** When set, all reads participate in this MongoDB transaction session. */
  session?: ClientSession;
  /** When set, eligibility uses this exact membership, not the first active one. */
  membershipId?: Types.ObjectId | string;
}

/**
 * Resolve effective access, or `null` when the User or Business id is invalid
 * or the Business does not exist. A valid Business with no access returns the
 * customer-only projection with source `none`; callers decide whether to
 * refuse it.
 */
export async function resolveEffectiveAccess(
  params: ResolveEffectiveAccessParams,
): Promise<EffectiveAccess | null> {
  if (
    !Types.ObjectId.isValid(params.userId) ||
    !Types.ObjectId.isValid(params.businessId)
  ) {
    return null;
  }

  const lookup: AccessLookup = {
    userId: params.userId,
    businessId: params.businessId,
    now: params.now ?? new Date(),
    session: params.session,
  };

  const business = (await withSession(
    Business.findById(lookup.businessId).select("companyId").lean(),
    lookup.session,
  )) as { companyId?: Types.ObjectId } | null;
  if (!business) return null;

  const membership = await findActiveEmployeeMembership({
    userId: lookup.userId,
    businessId: lookup.businessId,
    employeeId: params.membershipId,
    session: lookup.session,
  });

  if (
    business.companyId &&
    (await ownsBusiness(lookup, business.companyId))
  ) {
    return {
      businessId: lookup.businessId,
      effectiveLayer: "admin",
      source: "ownership",
      jobRoles: normalizeJobRoles(membership),
      capabilities: capabilitiesForLayer("admin"),
      canEnterBusiness: true,
    };
  }

  if (!membership) {
    return {
      businessId: lookup.businessId,
      effectiveLayer: "customer",
      source: "none",
      jobRoles: [],
      capabilities: [],
      canEnterBusiness: false,
    };
  }

  const jobRoles = normalizeJobRoles(membership);
  const effectiveLayer = resolveDefaultAccessLayerForRoles(jobRoles);
  const canEnterBusiness =
    effectiveLayer === "manager" || effectiveLayer === "admin"
      ? true
      : await isInsideEntryWindow(lookup, membership._id);

  return {
    businessId: lookup.businessId,
    effectiveLayer,
    source: "membership",
    jobRoles,
    capabilities: capabilitiesForLayer(effectiveLayer),
    canEnterBusiness,
  };
}

/**
 * True when the User can enter Business mode at any venue they own or belong
 * to. Ownership and manager/admin are always enterable; supervisor/employee
 * follow the same entry window as the per-venue access read.
 */
export async function canEnterBusinessAnywhere(params: {
  userId: string;
  now?: Date;
  session?: ClientSession;
}): Promise<boolean> {
  const { userId, session } = params;
  if (!Types.ObjectId.isValid(userId)) return false;

  const now = params.now ?? new Date();
  const companyIds = await findOwnedCompanyIds({ userId, session });
  if (companyIds.length) {
    const businesses = (await withSession(
      Business.find({ companyId: { $in: companyIds } })
        .select("_id")
        .lean(),
      session,
    )) as Array<{ _id: Types.ObjectId }>;

    for (const business of businesses) {
      const access = await resolveEffectiveAccess({
        userId,
        businessId: String(business._id),
        now,
        session,
      });
      if (access?.canEnterBusiness) return true;
    }
  }

  const membership = await findActiveEmployeeMembership({ userId, session });
  if (!membership) return false;

  const access = await resolveEffectiveAccess({
    userId,
    businessId: String(membership.businessId),
    now,
    session,
  });
  return access?.canEnterBusiness === true;
}

async function ownsBusiness(
  lookup: AccessLookup,
  companyId: Types.ObjectId,
): Promise<boolean> {
  const companyIds = await findOwnedCompanyIds(lookup);
  return companyIds.some((ownedCompanyId) => ownedCompanyId.equals(companyId));
}

async function findOwnedCompanyIds(params: {
  userId: string;
  session?: ClientSession;
}): Promise<Types.ObjectId[]> {
  const owner = (await withSession(
    Owner.findOne({ userId: params.userId }).select("_id").lean(),
    params.session,
  )) as { _id: Types.ObjectId } | null;
  if (!owner) return [];

  const companies = (await withSession(
    Company.find(withSoftDeleteFilter({ ownerId: owner._id }))
      .select("_id")
      .lean(),
    params.session,
  )) as Array<{ _id: Types.ObjectId }>;

  return companies.map((company) => company._id);
}

function normalizeJobRoles(membership: EmployeeMembership | null): string[] {
  if (!membership || !Array.isArray(membership.allEmployeeRoles)) return [];
  return membership.allEmployeeRoles.map((role) => String(role));
}

function capabilitiesForLayer(layer: AccessLayer): AccessCapabilityKey[] {
  return [...getDefaultCapabilities(layer)];
}

/**
 * An entry window belongs to a non-vacation planned shift for today. It opens
 * ten minutes before planned start and closes two hours after planned start;
 * shift end is irrelevant to entry.
 */
async function isInsideEntryWindow(
  lookup: AccessLookup,
  employeeId: Types.ObjectId,
): Promise<boolean> {
  const startOfDay = new Date(lookup.now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const schedule = (await withSession(
    Schedule.findOne({
      businessId: lookup.businessId,
      date: { $gte: startOfDay, $lt: endOfDay },
    })
      .select("employeesSchedules")
      .lean(),
    lookup.session,
  )) as {
    employeesSchedules?: Array<{
      employeeId: unknown;
      vacation?: boolean;
      timeRange: { startTime: Date };
    }>;
  } | null;

  if (!schedule?.employeesSchedules?.length) return false;

  const employeeIdString = employeeId.toString();
  const nowMs = lookup.now.getTime();
  return schedule.employeesSchedules.some((entry) => {
    if (entry.vacation) return false;
    if (String(entry.employeeId) !== employeeIdString) return false;

    const startMs = new Date(entry.timeRange.startTime).getTime();
    return (
      nowMs >= startMs - ENTRY_WINDOW_BEFORE_START_MS &&
      nowMs <= startMs + ENTRY_WINDOW_AFTER_START_MS
    );
  });
}

/**
 * Attach the caller's transaction session when one is present. Keeping this in
 * one place means every read in a lookup observes the same transaction.
 */
function withSession<T extends { session(session: ClientSession): T }>(
  query: T,
  session?: ClientSession,
): T {
  return session ? query.session(session) : query;
}
