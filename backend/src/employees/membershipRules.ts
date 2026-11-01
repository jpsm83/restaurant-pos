/**
 * Membership hire and edit rules — the workforce invariants the employees
 * routes enforce.
 *
 * Role assignment follows the access subject's bounds: each actor may assign
 * only roles whose default layer is strictly below their own, except the owning
 * User, who may assign any canonical role. The same bound decides which
 * existing memberships an actor may edit. Rehire is recognised here as moving a
 * Terminated membership (or a legacy row carrying termination data) back to a
 * non-Terminated status.
 */
import {
  compareAccessLayers,
  getDefaultAccessLayerForJobRole,
  type BusinessAccessLayer,
} from "restaurant-pos-packages/access";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";
import type { CreateEmployeeBody } from "restaurant-pos-packages/schemas/employee";

import type { EffectiveAccess } from "../access/resolveEffectiveAccess.ts";

export const TERMINATED_EMPLOYMENT_STATUS = "Terminated";

/**
 * The actor may assign only roles whose default layer is strictly below their
 * own. The owning User is the exception: they may assign any canonical role,
 * including Owner and Admin. An admin who is not the owner therefore cannot
 * assign Owner/Admin, and a manager cannot assign manager/admin.
 */
export function canAssignRoles(
  access: EffectiveAccess,
  roles: string[],
): boolean {
  if (access.source === "ownership") return true;

  return roles.every(
    (role) =>
      compareAccessLayers(
        getDefaultAccessLayerForJobRole(role),
        access.effectiveLayer,
      ) < 0,
  );
}

/**
 * An actor may edit only memberships whose current layer is strictly below
 * their own. Only the owning User may edit a peer admin membership.
 */
export function canEditMembership(
  access: EffectiveAccess,
  currentLayer: BusinessAccessLayer,
): boolean {
  if (access.source === "ownership") return true;
  return compareAccessLayers(currentLayer, access.effectiveLayer) < 0;
}

/** A membership is terminated by its stored status, or legacy termination data. */
export function isTerminatedMembership(
  employee: Pick<IEmployee, "employmentStatus" | "terminatedDate">,
): boolean {
  if (employee.employmentStatus) {
    return employee.employmentStatus === TERMINATED_EMPLOYMENT_STATUS;
  }
  return Boolean(employee.terminatedDate);
}

/**
 * Apply a create request's fields to a membership. Used both for a fresh row
 * and to reactivate a soft-deleted row in place, so a hire never duplicates a
 * User/Business link. Reactivation preserves optional HR data the request did
 * not resubmit; a fresh row simply leaves those fields absent.
 */
export function applyHireFields(
  employee: Partial<IEmployee>,
  fields: CreateEmployeeBody,
  options: { preserveOptional?: boolean } = {},
): void {
  const preserveOptional = options.preserveOptional ?? false;

  employee.allEmployeeRoles = fields.allEmployeeRoles;
  employee.employmentStatus = fields.employmentStatus;
  employee.joinDate = fields.joinDate;
  employee.terminatedDate = undefined;

  if (fields.taxNumber !== undefined) employee.taxNumber = fields.taxNumber;
  else if (!preserveOptional) employee.taxNumber = undefined;

  if (fields.vacationDaysPerYear !== undefined) {
    employee.vacationDaysPerYear = fields.vacationDaysPerYear;
    employee.vacationDaysLeft = fields.vacationDaysPerYear;
  } else if (!preserveOptional) {
    employee.vacationDaysPerYear = undefined;
    employee.vacationDaysLeft = undefined;
  }

  if (fields.contractHoursWeek !== undefined) {
    employee.contractHoursWeek = fields.contractHoursWeek;
  } else if (!preserveOptional) {
    employee.contractHoursWeek = undefined;
  }

  if (fields.salary !== undefined) employee.salary = fields.salary;
  else if (!preserveOptional) employee.salary = undefined;

  if (fields.comments !== undefined) employee.comments = fields.comments;
  else if (!preserveOptional) employee.comments = undefined;
}
