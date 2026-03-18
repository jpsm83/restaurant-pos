/**
 * Auth Types - JWT payload and session structures
 *
 * Matches legacy NextAuth session structure for full parity.
 */

export interface AuthBusiness {
  id: string;
  email: string;
  type: "business";
}

export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  employeeId?: string;
  businessId?: string;
  canLogAsEmployee?: boolean;
}

export type AuthSession = AuthBusiness | AuthUser;

export interface JwtPayload {
  id: string;
  email: string;
  type: "business" | "user";
  employeeId?: string;
  businessId?: string;
  canLogAsEmployee?: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  id: string;
  type: "business" | "user";
  iat?: number;
  exp?: number;
}
