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
 * - **Pages** use `login`, `signup`, `logout`, `getCurrentUser` from **`@/auth`** (barrel).
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const ACCESS_TOKEN_STORAGE_KEY = "restaurant_pos_auth_access";

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
  const hasBody = options?.body !== undefined && options?.body !== null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
