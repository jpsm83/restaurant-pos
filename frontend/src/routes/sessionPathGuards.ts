import type { AuthSession } from "@/auth/types";

/** MongoDB ObjectId as 24 hex chars (case-insensitive). */
const MONGO_OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

export function isLikelyMongoObjectIdString(value: string | undefined): boolean {
  return Boolean(value && MONGO_OBJECT_ID_HEX.test(value));
}

/**
 * True when the URL `:userId` matches the logged-in person account.
 * Use on `/:userId/*` routes; never trust the path alone for authorization (backend is source of truth).
 */
export function matchesSessionUserId(
  paramUserId: string | undefined,
  user: AuthSession | null | undefined,
): boolean {
  if (!paramUserId || !user || user.type !== "user") return false;
  return paramUserId === user.id;
}

/**
 * True when the URL `:businessId` matches the logged-in business (tenant) account.
 */
export function matchesSessionBusinessId(
  paramBusinessId: string | undefined,
  user: AuthSession | null | undefined,
): boolean {
  if (!paramBusinessId || !user || user.type !== "business") return false;
  return paramBusinessId === user.id;
}

export function canonicalBusinessDashboardPath(user: AuthSession): string {
  return `/business/${user.id}`;
}

export function canonicalUserCustomerPath(user: AuthSession): string {
  return `/${user.id}/customer`;
}

export function canonicalUserModePath(user: AuthSession): string {
  return `/${user.id}/mode`;
}

export function canonicalUserEmployeePath(user: AuthSession): string {
  return `/${user.id}/employee`;
}
