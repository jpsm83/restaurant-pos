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
  /** Stored UI language preference; unset until the person chooses one. */
  languagePreference?: "en" | "es";
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
  /** Server-owned id of the refresh session this access token was issued for. */
  sessionId?: string;
  iat?: number;
  exp?: number;
}

/** Signed refresh cookie. `sid` identifies one stored refresh session. */
export interface RefreshTokenPayload {
  sid: string;
  iat?: number;
  exp?: number;
}
