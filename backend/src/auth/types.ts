/**
 * Auth Types - JWT payload and session structures
 *
 * Matches legacy NextAuth session structure for full parity.
 */

import type { IAuthMode } from "restaurant-pos-packages/interfaces/IAuth";

export type AuthMode = IAuthMode;

export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  /** Present when issued by login / refresh / signup; drives verification UI. */
  emailVerified?: boolean;
  /** Stored UI language preference; unset until the person chooses one. */
  languagePreference?: "en" | "es";
  /** Active Customer | Business mode stored on the refresh session. */
  mode?: AuthMode;
  employeeId?: string;
  businessId?: string;
  canLogAsEmployee?: boolean;
  /**
   * `Customer` when not linked as staff; otherwise primary entry from `Employee.allEmployeeRoles`.
   */
  role: string;
}

export type AuthSession = AuthUser;

export interface JwtPayload {
  id: string;
  email: string;
  type: "user";
  emailVerified?: boolean;
  languagePreference?: "en" | "es";
  mode?: AuthMode;
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
