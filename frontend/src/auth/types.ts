/**
 * **`src/auth`** — shared **TypeScript contracts** for JWT session payloads and auth UI state.
 * Used by `api.ts` and `store/AuthContext.tsx`.
 *
 * Shapes mirror **`backend/src/auth/types.ts`** where noted — keep in sync when the API changes.
 */
export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

/**
 * JWT session payload for tenant (business) login.
 * Mirrors `backend/src/auth/types.ts` — `AuthBusiness`.
 */
export interface AuthBusiness {
  id: string;
  email: string;
  type: "business";
}

/**
 * JWT session payload for a person (User) login.
 * Mirrors `backend/src/auth/types.ts` — `AuthUser`.
 */
export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  /** Present when linked to an active Employee (`User.employeeDetails`). */
  employeeId?: string;
  /** Employing tenant when `employeeId` is set. */
  businessId?: string;
  /** From backend `canLogAsEmployee` (schedule + role); drives employee mode eligibility. */
  canLogAsEmployee?: boolean;
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
}

export interface AuthState {
  /** Current JWT session (business or user); `state.user` naming kept for existing code. */
  user: AuthSession | null;
  status: AuthStatus;
  error: string | null;
}
