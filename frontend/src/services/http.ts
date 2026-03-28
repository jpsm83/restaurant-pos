/**
 * HTTP transport for **`src/services`**: API modules use this `http` instance so Bearer tokens,
 * `baseURL`, and cookies stay consistent.
 *
 * ## Wiring
 * - **Token:** interceptor uses `getAccessToken()` from `auth/api.ts` (module singleton, not Context).
 * - **Cookies:** `withCredentials: true` for HttpOnly cookies (e.g. `auth_mode`).
 * - **Consumers:** `authMode.ts`, `businessService.ts`, `schedulesService.ts` (see `services/index.ts`).
 *
 * **Convention:** UI uses React Query hooks that call async functions wrapping `http`. `auth/api.ts`
 * may still use `fetch` for legacy auth until migrated.
 */
import axios from "axios";
import { getAccessToken } from "@/auth/api";
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
  return config;
});
