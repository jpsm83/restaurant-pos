import axios from "axios";
import { getAccessToken } from "@/auth/api";

/**
 * Shared Axios client for the app (Phase 0.4).
 *
 * **Convention:** Prefer `useQuery` / `useMutation` in components, calling functions that use this
 * `http` instance (or raw `http.get` etc.). Legacy auth flows may keep `fetch` in `auth/api.ts` until migrated.
 *
 * Token source: same in-memory access token as `auth/api.ts` (`getAccessToken`).
 */
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
