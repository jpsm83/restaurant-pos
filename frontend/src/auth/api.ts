/**
 * **Auth HTTP client** (`src/auth`) — **`fetch`**-based calls to **`/api/v1/auth/*`** (not Axios).
 *
 * ## Token model
 * - **In-memory** `accessToken` + **`sessionStorage`** (`restaurant_pos_auth_access`) for same-tab reloads.
 * - **Refresh** uses HttpOnly cookie via `credentials: "include"` on `POST /refresh`.
 * - **`getAccessToken` / `setAccessToken`** are imported by **`services/http.ts`** so Axios requests get the same Bearer as these `fetch` calls.
 *
 * ## Wiring
 * - **`AuthProvider`** (`store/AuthContext.tsx`) calls `loadPersistedAccessToken`, `getCurrentUser`, `refreshSession`, `setAccessToken` on bootstrap.
 * - **Pages** use `login`, `signup`, `logout`, `getCurrentUser`, and public email/password flows from **`@/auth/api`**.
 * - **`businessService.createBusiness`** calls **`setAccessToken`** when registration returns a token.
 * - **`logout`** clears token and **`queryClient.removeQueries`** for `auth.mode` (TanStack cache); broader invalidation can be added here if needed.
 *
 * **401 handling:** `authRequest` retries once after **`refreshSession`** (except when `retryOnUnauthorized` is false for login/signup/refresh/logout).
 */
import type {
  AuthLoginSnapshot,
  AuthSession,
  LoginCredentials,
  SignupCredentials,
} from "./types";
import { queryClient } from "@/services/queryClient";
import { queryKeys } from "@/services/queryKeys";

const ACCESS_TOKEN_STORAGE_KEY = "restaurant_pos_auth_access";

/**
 * Resolves the origin/base for auth `fetch` calls.
 *
 * In **Vite dev**, if `VITE_API_BASE_URL` targets another origin (e.g. `http://localhost:4000` while
 * the SPA is on `http://localhost:5173`), we use **relative** `/api/...` so the dev server **proxy**
 * forwards to Fastify. That avoids **CORS** failures and keeps the refresh cookie **first-party**
 * (see `frontend/.env.example`).
 *
 * In **production**, when the API host matches the page host, use the configured base; when they
 * differ, the configured full URL is used and the API must allow the app origin via **`CORS_ORIGINS`**.
 */
function resolveAuthFetchBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  const configured =
    typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";

  if (typeof window === "undefined") {
    return configured;
  }

  if (!configured) {
    return "";
  }

  let apiOrigin: string;
  try {
    apiOrigin = new URL(configured).origin;
  } catch {
    return configured;
  }

  if (window.location.origin === apiOrigin) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return "";
  }

  return configured;
}

let accessToken: string | null = null;

/** Persists access JWT for same-tab reloads; refresh cookie remains the long-lived secret (httpOnly). */
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") return;
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // private mode / quota
  }
}

/** Read token saved for this tab (before in-memory module state is set). */
export function loadPersistedAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Successful auth endpoints return `accessToken` + `user` session payload (same shape as `/auth/me`’s `user`). */
interface AuthTokenResponseBody {
  accessToken?: string;
  user?: AuthSession;
  message?: string;
}

/** Many unauthenticated auth routes return `{ message }` (success, generic, or error copy). */
type AuthMessageResponseBody = { message?: string };

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getAuthHeaders(headers?: HeadersInit, hasBody = false): HeadersInit {
  const nextHeaders = new Headers(headers);
  if (hasBody && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  return nextHeaders;
}

async function authRequest<T>(
  path: string,
  options?: RequestInit,
  retryOnUnauthorized = true
): Promise<{ ok: true; data: T | null } | { ok: false; error: string }> {
  try {
    const hasBody = options?.body !== undefined && options?.body !== null;
    const response = await fetch(`${resolveAuthFetchBaseUrl()}${path}`, {
      credentials: "include",
      headers: getAuthHeaders(options?.headers, hasBody),
      ...options,
    });

    const payload = await parseJson<{ message?: string } & T>(response);

    if (response.status === 401 && retryOnUnauthorized) {
      const refreshed = await refreshSession();

      if (refreshed.ok) {
        return authRequest<T>(path, options, false);
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.message ?? "Request failed",
      };
    }

    return { ok: true, data: payload };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not reach the server.";
    return { ok: false, error: message };
  }
}

export async function login(credentials: LoginCredentials) {
  const result = await authRequest<AuthTokenResponseBody>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify(credentials),
    },
    false
  );

  if (result.ok) {
    setAccessToken(result.data?.accessToken ?? null);
    return {
      ok: true as const,
      data: {
        accessToken: result.data?.accessToken,
        user: result.data?.user ?? null,
      } satisfies AuthLoginSnapshot,
    };
  }

  return result;
}

export async function signup(credentials: SignupCredentials) {
  const result = await authRequest<AuthTokenResponseBody>(
    "/api/v1/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(credentials),
    },
    false
  );

  if (result.ok) {
    setAccessToken(result.data?.accessToken ?? null);
    return {
      ok: true as const,
      data: {
        accessToken: result.data?.accessToken,
        user: result.data?.user ?? null,
      } satisfies AuthLoginSnapshot,
    };
  }

  return result;
}

export async function refreshSession() {
  const result = await authRequest<AuthTokenResponseBody>(
    "/api/v1/auth/refresh",
    {
      method: "POST",
    },
    false
  );

  if (result.ok) {
    setAccessToken(result.data?.accessToken ?? null);
    return {
      ok: true as const,
      data: {
        accessToken: result.data?.accessToken,
        user: result.data?.user ?? null,
      } satisfies AuthLoginSnapshot,
    };
  }

  setAccessToken(null);
  return result;
}

export async function getCurrentUser() {
  const result = await authRequest<{ user?: AuthSession }>("/api/v1/auth/me", {
    method: "GET",
  });

  if (result.ok) {
    return { ok: true as const, data: result.data?.user ?? null };
  }

  return result;
}

/** Unauthenticated: request a sign-in email verification message (anti-enumeration; **200** + generic message). */
export async function requestEmailConfirmation(email: string) {
  return authRequest<AuthMessageResponseBody>(
    "/api/v1/auth/request-email-confirmation",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    false,
  );
}

/** Unauthenticated: consume email verification **token** from the link (one-time). */
export async function confirmEmail(token: string) {
  return authRequest<AuthMessageResponseBody>(
    "/api/v1/auth/confirm-email",
    {
      method: "POST",
      body: JSON.stringify({ token }),
    },
    false,
  );
}

/** Unauthenticated: request a password-reset email (same generic **200** body as confirmation request). */
export async function requestPasswordReset(email: string) {
  return authRequest<AuthMessageResponseBody>(
    "/api/v1/auth/request-password-reset",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    false,
  );
}

/** Unauthenticated: set a new password using the reset **token** from the email link. */
export async function resetPassword(token: string, newPassword: string) {
  return authRequest<AuthMessageResponseBody>(
    "/api/v1/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    },
    false,
  );
}

/** Authenticated: resend sign-in email confirmation for the current account (server uses DB email). */
export async function resendEmailConfirmation() {
  return authRequest<AuthMessageResponseBody>(
    "/api/v1/auth/resend-email-confirmation",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function logout() {
  const result = await authRequest<{ message?: string }>(
    "/api/v1/auth/logout",
    {
      method: "POST",
    },
    false
  );

  setAccessToken(null);
  queryClient.removeQueries({ queryKey: queryKeys.auth.mode() });
  return result;
}

export function getAccessToken() {
  return accessToken;
}
