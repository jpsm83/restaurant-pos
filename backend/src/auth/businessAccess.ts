/**
 * One seam for resolving a signed-in User's access to a specific Business.
 *
 * A User may act on a venue when they own it through
 * User → Owner → Company → Business, or when they hold an active Employee
 * membership for that venue. Effective layers, capabilities, and Business-mode
 * eligibility are resolved by `resolveEffectiveAccess`; this module keeps the
 * existing owner-versus-employee and boolean checks for existing callers.
 */

import { resolveEffectiveAccess } from "../access/resolveEffectiveAccess.ts";

export type BusinessAccessKind = "owner" | "employee";

export async function resolveBusinessAccess(
  userId: string,
  businessId: string,
): Promise<BusinessAccessKind | null> {
  const access = await resolveEffectiveAccess({ userId, businessId });
  if (access?.source === "ownership") return "owner";
  if (access?.source === "membership") return "employee";
  return null;
}

export async function canAccessBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  return (await resolveBusinessAccess(userId, businessId)) !== null;
}
