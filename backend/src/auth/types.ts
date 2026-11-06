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
  /** Stored appearance preference; unset until the person chooses one. */
  themePreference?: "light" | "dark" | "system";
  /** Stored profile picture URL, from a Google account or an uploaded photo. */
  imageUrl?: string;
  /** Stored given name; seeds the avatar initials fallback. */
  firstName?: string;
  /** Stored family name; seeds the avatar initials fallback. */
  lastName?: string;
  /** Whether the User holds a linked Google identity (never the subject itself). */
  hasGoogleIdentity?: boolean;
  /** Whether the User holds a password credential (never the hash itself). */
  hasPassword?: boolean;
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

/**
 * The account and refresh-session facts a credential must carry before it is
 * rebuilt into an `AuthUser` session. A live ticket satisfies this contract
 * without inventing the profile fields a ticket does not hold.
 */
export interface RefreshSessionIdentity {
  id: string;
  type: AuthUser["type"];
  sessionId?: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  type: "user";
  emailVerified?: boolean;
  languagePreference?: "en" | "es";
  themePreference?: "light" | "dark" | "system";
  imageUrl?: string;
  firstName?: string;
  lastName?: string;
  hasGoogleIdentity?: boolean;
  hasPassword?: boolean;
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
