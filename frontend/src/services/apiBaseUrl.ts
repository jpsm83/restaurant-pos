/**
 * Resolves the origin/base for first-party HTTP calls.
 *
 * In **Vite dev**, if `VITE_API_BASE_URL` targets another origin (e.g.
 * `http://localhost:4000` while the SPA is on `http://localhost:5173`), we use
 * **relative** `/api/...` so the dev server proxy forwards to Fastify. That
 * avoids CORS failures and keeps cookies first-party.
 *
 * In **production**, when the API host matches the page host, use the configured
 * base; when they differ, use the configured full URL and let the API allow the
 * app origin via `CORS_ORIGINS`.
 */
export function resolveApiBaseUrl(): string {
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
