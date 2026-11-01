/**
 * Membership employment-status rules.
 *
 * One place decides whether a membership is usable, blocked, or terminated.
 * The access resolver, self-view, and route transitions all consume these
 * helpers so a stored status and a legacy `active`/`terminatedDate` row cannot
 * drift apart.
 */
import {
  activeEmploymentStatusEnums,
  isBlockedEmploymentStatus,
  TERMINATED_EMPLOYMENT_STATUS,
} from "restaurant-pos-packages/enums";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";

type MembershipStatusFacts = Pick<
  IEmployee,
  "employmentStatus" | "active" | "terminatedDate"
>;

/**
 * The database filter for a usable membership: a stored employed status, or a
 * legacy row with no status that still has `active: true` and no termination.
 */
export const usableMembershipFilter = {
  $or: [
    { employmentStatus: { $in: activeEmploymentStatusEnums } },
    { employmentStatus: null, active: true, terminatedDate: null },
  ],
};

/** True when status or the legacy fields remove the membership's access. */
export function isBlockedMembership(employee: MembershipStatusFacts): boolean {
  if (employee.employmentStatus) {
    return isBlockedEmploymentStatus(employee.employmentStatus);
  }
  return employee.active === false || Boolean(employee.terminatedDate);
}

/** A membership is terminated by its stored status, or legacy termination data. */
export function isTerminatedMembership(employee: MembershipStatusFacts): boolean {
  if (employee.employmentStatus) {
    return employee.employmentStatus === TERMINATED_EMPLOYMENT_STATUS;
  }
  return Boolean(employee.terminatedDate);
}

/** True when a status change ends employment at the venue. */
export function isTerminationStatus(status: string): boolean {
  return status === TERMINATED_EMPLOYMENT_STATUS;
}
