import { Types } from "mongoose";

/**
 * Roles that count as management/superior for permission checks (cancel, void,
 * invitation, discount, close daily report, edit purchases, etc.).
 */
export const MANAGEMENT_ROLES: readonly string[] = [
  "Owner",
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
  "Supervisor",
];

/**
 * Returns true if the given roles array includes at least one management role.
 */
export function hasManagementRole(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((role) => MANAGEMENT_ROLES.includes(role));
}

/**
 * Fixed ObjectId used to attribute delivery sales in the daily report.
 * When employeesDailySalesReport[].userId equals this id, the UI should display "Delivery"
 * (no real User document has this id).
 */
export const DELIVERY_ATTRIBUTION_USER_ID = new Types.ObjectId(
  "000000000000000000000001"
);
