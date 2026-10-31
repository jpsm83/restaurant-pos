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
 * JWT session payload for the signed-in User.
 * Mirrors `backend/src/auth/types.ts` — `AuthUser`. The User is the only auth actor.
 */
export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  /** From login / refresh / signup; drives verification UI. */
  emailVerified?: boolean;
  /** Stored UI language preference; drives language hydration when set. */
  languagePreference?: "en" | "es";
  /** Whether the User holds a linked Google identity. */
  hasGoogleIdentity?: boolean;
  /** Whether the User holds a password credential. */
  hasPassword?: boolean;
  /** Active Customer | Business mode stored on the refresh session. */
  mode?: "customer" | "business";
  /** Present when the User has an active Employee membership. */
  employeeId?: string;
  /** Employing tenant when `employeeId` is set. */
  businessId?: string;
  /** From backend `canLogAsEmployee` (schedule + role); drives Business mode eligibility. */
  canLogAsEmployee?: boolean;
  /** `Customer` or primary `Employee.allEmployeeRoles` entry from backend. */
  role: string;
}

/**
 * JWT payload returned in `user` from login, signup, refresh, and `GET /api/v1/auth/me`.
 * Mirrors `backend/src/auth/types.ts` — `AuthSession`.
 */
export type AuthSession = AuthUser;

/**
 * Successful login / signup / refresh response: optional access token + session payload.
 */
export interface AuthLoginSnapshot {
  accessToken?: string;
  user: AuthSession | null;
  /** A soft-deleted account must confirm the email reactivation link first. */
  reactivationRequired?: boolean;
  /** Google would create a User, so the client must collect acceptance first. */
  consentRequired?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface GoogleAuthCredentials {
  /** Google ID token returned by the Google provider. */
  credential: string;
  /** Supplied/browser language for a new Google User. */
  languagePreference?: "en" | "es";
  /** Composite privacy-notice and account-terms acceptance proof. */
  privacyAccepted?: boolean;
}

export interface SignupCredentials {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languagePreference?: "en" | "es";
  /** Composite privacy-notice and account-terms acceptance proof. */
  privacyAccepted: boolean;
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
  /** Current JWT session for the signed-in User. */
  user: AuthSession | null;
  status: AuthStatus;
  /** Machine code only; UI surfaces resolve it to localized copy at render time. */
  error: ServiceErrorCode | null;
}
