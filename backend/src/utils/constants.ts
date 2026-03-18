import { Types } from "mongoose";

export const MANAGEMENT_ROLES: readonly string[] = [
  "Owner",
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
  "Supervisor",
];

export function hasManagementRole(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((role) => MANAGEMENT_ROLES.includes(role));
}

export const DELIVERY_ATTRIBUTION_USER_ID = new Types.ObjectId(
  "000000000000000000000001"
);
