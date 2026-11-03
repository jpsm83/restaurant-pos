/**
 * The non-sensitive membership self-view.
 *
 * An ordinary member may read their own roles, status, join date, contract
 * hours, vacation allowance and remaining days, and documents. Pay, tax
 * number, national ID, HR comments, and soft-delete metadata are manager-only
 * and never enter this projection.
 */
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";

import { isBlockedMembership } from "./membershipStatus.ts";

/** The non-sensitive fields an ordinary member may read about themselves. */
export type MembershipSelfView = Pick<
  IEmployee,
  | "_id"
  | "businessId"
  | "allEmployeeRoles"
  | "joinDate"
  | "contractHoursWeek"
  | "vacationDaysPerYear"
  | "vacationDaysLeft"
  | "documentsUrl"
  | "employmentStatus"
>;

/** True when the membership may not expose even its own self-view. */
export function isBlockedForSelfView(employee: IEmployee): boolean {
  return Boolean(employee.deleted) || isBlockedMembership(employee);
}

/** Project one membership into the ordinary member's safe self-view. */
export function toMembershipSelfView(employee: IEmployee): MembershipSelfView {
  const view: MembershipSelfView = {
    _id: employee._id,
    businessId: employee.businessId,
    allEmployeeRoles: employee.allEmployeeRoles,
    joinDate: employee.joinDate,
    contractHoursWeek: employee.contractHoursWeek,
    vacationDaysPerYear: employee.vacationDaysPerYear,
    vacationDaysLeft: employee.vacationDaysLeft,
    documentsUrl: employee.documentsUrl,
  };

  if (typeof employee.employmentStatus === "string") {
    view.employmentStatus = employee.employmentStatus;
  }

  return view;
}
