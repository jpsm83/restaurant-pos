export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  type?: "user" | "business";
}

export interface AuthSession {
  accessToken?: string;
  user: AuthUser | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
}
