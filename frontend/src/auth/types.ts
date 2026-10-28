/**
 * **`src/auth`** — shared **TypeScript contracts** for JWT session payloads and auth UI state.
 * Used by `api.ts` and `store/AuthContext.tsx`.
 *
 * Shapes mirror **`backend/src/auth/types.ts`** where noted — keep in sync when the API changes.
 */
import type { ServiceErrorCode } from "@/services/serviceErrors";
import type { IAddress } from "restaurant-pos-packages/interfaces/IAddress";
import type { IPersonalDetails } from "restaurant-pos-packages/interfaces/IPersonalDetails";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

/**
 * JWT session payload for tenant (business) login.
 * Mirrors `backend/src/auth/types.ts` — `AuthBusiness`.
 */
export interface AuthBusiness {
  id: string;
  email: string;
  type: "business";
  /** From login / refresh / registration; drives verification UI. */
  emailVerified?: boolean;
  /** Tenant sign-in; mirrors backend `AuthBusiness.role`. */
  role: "Tenant";
}

/**
 * JWT session payload for a person (User) login.
 * Mirrors `backend/src/auth/types.ts` — `AuthUser`.
 */
export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  /** From login / refresh / signup; drives verification UI. */
  emailVerified?: boolean;
  /** Stored UI language preference; drives language hydration when set. */
  languagePreference?: "en" | "es";
  /** Present when the User has an active Employee membership. */
  employeeId?: string;
  /** Employing tenant when `employeeId` is set. */
  businessId?: string;
  /** From backend `canLogAsEmployee` (schedule + role); drives employee mode eligibility. */
  canLogAsEmployee?: boolean;
  /** `Customer` or primary `Employee.allEmployeeRoles` entry from backend. */
  role: string;
}

/**
 * JWT payload union returned in `user` from login, signup, refresh, and `GET /api/v1/auth/me`.
 * Mirrors `backend/src/auth/types.ts` — `AuthSession`.
 */
export type AuthSession = AuthBusiness | AuthUser;

/**
 * Successful login / signup / refresh response: optional access token + session payload.
 */
export interface AuthLoginSnapshot {
  accessToken?: string;
  user: AuthSession | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languagePreference?: "en" | "es";
}

/** The client-settable profile fields returned by the users API. */
export type UserProfileAddress = IAddress;

export type UserProfilePersonalDetails = Omit<
  IPersonalDetails,
  "password" | "emailVerified"
>;

export interface UserProfile {
  _id: string;
  personalDetails: UserProfilePersonalDetails;
  languagePreference?: "en" | "es";
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  /** Current JWT session (business or user); `state.user` naming kept for existing code. */
  user: AuthSession | null;
  status: AuthStatus;
  /** Machine code only; UI surfaces resolve it to localized copy at render time. */
  error: ServiceErrorCode | null;
}
