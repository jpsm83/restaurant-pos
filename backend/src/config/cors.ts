import type { FastifyCorsOptions } from "@fastify/cors";

/**
 * Parse explicit CORS origins from env.
 * Example: "https://app.example.com,https://admin.example.com"
 */
function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Local dev fallback when CORS_ORIGINS is not configured.
 * Accept localhost / 127.0.0.1 over http(s) on any port.
 */
function isAllowedLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostOk = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const schemeOk = url.protocol === "http:" || url.protocol === "https:";
    return hostOk && schemeOk;
  } catch {
    return false;
  }
}

/**
 * Shared CORS policy for browser clients.
 *
 * - With CORS_ORIGINS set: allow only explicit origins.
 * - Without CORS_ORIGINS in production: deny cross-origin.
 * - Without CORS_ORIGINS in non-production: allow localhost/127.0.0.1 origins.
 */
export function buildCorsOptions(env: NodeJS.ProcessEnv): FastifyCorsOptions {
  const explicitOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const isProduction = env.NODE_ENV === "production";

  return {
    credentials: true,
    origin: (origin, cb) => {
      // Non-browser callers (curl, server-to-server) do not send Origin.
      if (!origin) {
        cb(null, true);
        return;
      }

      if (explicitOrigins.length > 0) {
        cb(null, explicitOrigins.includes(origin));
        return;
      }

      if (isProduction) {
        cb(null, false);
        return;
      }

      cb(null, isAllowedLocalDevOrigin(origin));
    },
  };
}

export const corsConfig = {
  buildCorsOptions,
};
