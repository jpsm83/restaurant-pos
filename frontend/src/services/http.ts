/**
 * HTTP transport for **`src/services`**: API modules use this `http` instance so Bearer tokens,
 * `baseURL`, and cookies stay consistent.
 *
 * ## Wiring
 * - **Token:** interceptor uses `getAccessToken()` from `auth/api.ts` (module singleton, not Context).
 * - **Cookies:** `withCredentials: true` for the HttpOnly refresh cookie.
 * - **Write gate:** signed-in domain writes leave only while this tab is live-and-resynced.
 *   Session auth and table-load POSTs (`skipWriteGate`) are not writes.
 * - **Consumers:** `authMode.ts`, `businessService.ts`, `schedulesService.ts`.
 *
 * **Convention:** UI uses React Query hooks that call async functions wrapping `http`. `auth/api.ts`
 * may still use `fetch` for legacy auth until migrated.
 */
import axios, { type AxiosRequestConfig } from "axios";
import { getAccessToken } from "@/auth/api";
import { assertWritesAllowed } from "@/live/writeGate";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Table load POSTs and other reads that happen to use POST. */
    skipWriteGate?: boolean;
  }
}

const SESSION_AUTH_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/signup",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/auth/request-password-reset",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/confirm-email",
  "/api/v1/auth/request-email-confirmation",
  "/api/v1/auth/resend-email-confirmation",
  "/api/v1/auth/live-ticket",
] as const;

function requestPath(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url, "http://local.invalid").pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function isMutatingMethod(method?: string): boolean {
  const normalized = (method ?? "get").toLowerCase();
  return (
    normalized === "post" ||
    normalized === "put" ||
    normalized === "patch" ||
    normalized === "delete"
  );
}

function isSessionAuthRequest(url?: string): boolean {
  const path = requestPath(url);
  return SESSION_AUTH_PATHS.includes(path as (typeof SESSION_AUTH_PATHS)[number]);
}

function shouldGateWrite(config: AxiosRequestConfig): boolean {
  if (config.skipWriteGate) return false;
  if (!isMutatingMethod(config.method)) return false;
  if (isSessionAuthRequest(config.url)) return false;
  return true;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (shouldGateWrite(config)) {
    assertWritesAllowed();
  }
  return config;
});
