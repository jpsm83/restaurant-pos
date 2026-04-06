/**
 * Auth Types - JWT payload and session structures
 *
 * Matches legacy NextAuth session structure for full parity.
 */

export interface AuthBusiness {
  id: string;
  email: string;
  type: "business";
  /** Present when issued by login / refresh / signup; drives verification UI. */
  emailVerified?: boolean;
  /** Tenant sign-in actor; use for future route guards (not `User` employee role enums). */
  role: "Tenant";
}

export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  /** Present when issued by login / refresh / signup; drives verification UI. */
  emailVerified?: boolean;
  employeeId?: string;
  businessId?: string;
  canLogAsEmployee?: boolean;
  /**
   * `Customer` when not linked as staff; otherwise primary entry from `Employee.allEmployeeRoles`.
   */
  role: string;
}

export type AuthSession = AuthBusiness | AuthUser;

export interface JwtPayload {
  id: string;
  email: string;
  type: "business" | "user";
  emailVerified?: boolean;
  employeeId?: string;
  businessId?: string;
  canLogAsEmployee?: boolean;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  id: string;
  type: "business" | "user";
  /** Monotonic session generation; missing/undefined treated as **0** (legacy cookies). */
  v?: number;
  iat?: number;
  exp?: number;
}
