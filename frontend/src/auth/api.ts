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
 * - **`logout`** clears token and **`queryClient.removeQueries`** for `auth.mode` (TanStack cache); broader invalidation can be added here if needed.
 * - **`setAccessToken`** opens the live connection with the access session just received, and closes it when the token is cleared.
 *
 * **401 handling:** `authRequest` retries once after **`refreshSession`** (except when `retryOnUnauthorized` is false for login/signup/refresh/logout).
 */
import type {
  AuthLoginSnapshot,
  AuthSession,
  LoginCredentials,
  SignupCredentials,
  UserProfile,
} from "./types";
import { queryClient } from "@/services/queryClient";
import { queryKeys } from "@/services/queryKeys";
import {
  toServiceRequestErrorFromResponse,
  toServiceTransportError,
  type ServiceOperation,
  type ServiceRequestError,
} from "@/services/serviceErrors";
import { syncLiveConnection } from "@/live/connection";
import { resolveApiBaseUrl } from "@/services/apiBaseUrl";

const ACCESS_TOKEN_STORAGE_KEY = "restaurant_pos_auth_access";

let accessToken: string | null = null;

/** Persists access JWT for same-tab reloads; refresh cookie remains the long-lived secret (httpOnly). */
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") {
    syncLiveConnection(token);
    return;
  }
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // private mode / quota
  }
  syncLiveConnection(token);
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

/** Let the runtime set the multipart boundary instead of forcing JSON. */
function hasJsonBody(body: BodyInit | null | undefined): boolean {
  return (
    body !== undefined &&
    body !== null &&
    !(typeof FormData !== "undefined" && body instanceof FormData)
  );
}

async function authRequest<T>(
  operation: ServiceOperation,
  path: string,
  options?: RequestInit,
  retryOnUnauthorized = true
): Promise<
  { ok: true; data: T | null } | { ok: false; error: ServiceRequestError }
> {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      credentials: "include",
      headers: getAuthHeaders(options?.headers, hasJsonBody(options?.body)),
      ...options,
    });

    const payload = await parseJson<{ message?: string } & T>(response);

    if (response.status === 401 && retryOnUnauthorized) {
      const refreshed = await refreshSession();

      if (refreshed.ok) {
        return authRequest<T>(operation, path, options, false);
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: toServiceRequestErrorFromResponse(
          operation,
          response.status,
          payload,
        ),
      };
    }

    return { ok: true, data: payload };
  } catch (e) {
    return { ok: false, error: toServiceTransportError(operation, e) };
  }
}

export async function login(credentials: LoginCredentials) {
  const result = await authRequest<AuthTokenResponseBody>(
    "signIn",
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
    "signUp",
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
    "session",
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
  const result = await authRequest<{ user?: AuthSession }>(
    "session",
    "/api/v1/auth/me",
    {
      method: "GET",
    },
  );

  if (result.ok) {
    return { ok: true as const, data: result.data?.user ?? null };
  }

  return result;
}

/** Unauthenticated: request a sign-in email verification message (anti-enumeration; **200** + generic message). */
export async function requestEmailConfirmation(email: string) {
  return authRequest<AuthMessageResponseBody>(
    "resendConfirmation",
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
    "confirmEmail",
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
    "passwordReset",
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
    "passwordReset",
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
    "resendConfirmation",
    "/api/v1/auth/resend-email-confirmation",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function logout() {
  const result = await authRequest<{ message?: string }>(
    "logout",
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

/** Authenticated self read of the client profile. */
export async function getUserProfile(userId: string) {
  return authRequest<UserProfile>(
    "profileFetch",
    `/api/v1/users/${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
}

/**
 * Authenticated self update of the client profile. The caller supplies the
 * multipart body; the response carries the updated profile, not a new session.
 */
export async function updateUserProfile(userId: string, formData: FormData) {
  return authRequest<{ message?: string; user?: UserProfile }>(
    "profileUpdate",
    `/api/v1/users/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: formData },
  );
}

export function getAccessToken() {
  return accessToken;
}
