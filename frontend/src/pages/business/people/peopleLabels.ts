/**
 * Closed-vocabulary labels for the People surface.
 *
 * The records are typed against the shared enums and job-role map, so adding a
 * role or employment status without its label key is a compile error.
 */
import {
  employmentStatusEnums,
  TERMINATED_EMPLOYMENT_STATUS,
  type EmploymentStatus,
} from "restaurant-pos-packages/enums";
import type { CanonicalJobRole } from "restaurant-pos-packages/access";

const ROLE_LABEL_KEYS: Record<CanonicalJobRole, string> = {
  Owner: "owner",
  Admin: "admin",
  "General Manager": "generalManager",
  Manager: "manager",
  "Assistant Manager": "assistantManager",
  MoD: "mod",
  Supervisor: "supervisor",
  Operator: "operator",
  Employee: "employee",
  Cashier: "cashier",
  "Floor Staff": "floorStaff",
  Bartender: "bartender",
  Barista: "barista",
  Waiter: "waiter",
  "Head Chef": "headChef",
  "Sous Chef": "sousChef",
  "Line Cooks": "lineCooks",
  "Kitchen Porter": "kitchenPorter",
  Cleaner: "cleaner",
  Security: "security",
  Host: "host",
  Runner: "runner",
  Entertainer: "entertainer",
  Other: "other",
};

const STATUS_LABEL_KEYS: Record<EmploymentStatus, string> = {
  Active: "active",
  Seasonal: "seasonal",
  "Medical absence": "medicalAbsence",
  "Parental leave": "parentalLeave",
  "Unpaid leave": "unpaidLeave",
  Suspended: "suspended",
  Terminated: "terminated",
};

/** A new membership cannot start Terminated, so the hire form omits it. */
export const HIRE_STATUS_OPTIONS = employmentStatusEnums.filter(
  (status) => status !== TERMINATED_EMPLOYMENT_STATUS,
);

/** Unknown legacy role values fall back to the generic label key. */
export function roleLabelKey(role: string): string {
  return ROLE_LABEL_KEYS[role as CanonicalJobRole] ?? "other";
}

/** Unknown legacy status values fall back to the generic label key. */
export function statusLabelKey(status: string): string {
  return STATUS_LABEL_KEYS[status as EmploymentStatus] ?? "other";
}
