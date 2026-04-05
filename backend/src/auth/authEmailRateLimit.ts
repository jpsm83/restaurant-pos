/**
 * Process-local rate limits for auth email endpoints (Phase 0).
 * Not shared across instances; document in ops if scaling horizontally.
 */

import type { VerificationIntent as VerificationIntentKind } from "../../../packages/authVerificationIntent.ts";

const ipHits = new Map<string, number[]>();
/** Per verification intent + normalized email (Phase 6). */
const verificationIntentEmailHits = new Map<string, number[]>();

function readPositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function pruneTimestamps(
  timestamps: number[],
  windowMs: number,
  now: number,
): number[] {
  return timestamps.filter((t) => now - t < windowMs);
}

export type AuthEmailIpRoute =
  | "request-email-confirmation"
  | "request-password-reset"
  | "resend-email-confirmation";

/**
 * Per-IP sliding window. Separate bucket per `route` (Phase 0).
 */
export function checkAuthEmailIpRate(
  route: AuthEmailIpRoute,
  ip: string,
): { allowed: true } | { allowed: false } {
  const max = readPositiveIntEnv("AUTH_EMAIL_RATE_LIMIT_IP_MAX", 30);
  const windowMs = readPositiveIntEnv(
    "AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS",
    900_000,
  );
  const now = Date.now();
  const key = `${route}:${ip || "unknown"}`;
  const prev = pruneTimestamps(ipHits.get(key) ?? [], windowMs, now);
  if (prev.length >= max) {
    return { allowed: false };
  }
  prev.push(now);
  ipHits.set(key, prev);
  return { allowed: true };
}

/**
 * Per-intent + per-email send cap (Phase 6). Separate buckets for e.g. confirmation vs password reset.
 * Returns false when over cap — caller should return **200 generic** and **not** send or rotate tokens.
 */
export function tryConsumeVerificationIntentEmailSlot(
  intent: VerificationIntentKind,
  normalizedEmail: string,
): boolean {
  const max = readPositiveIntEnv("AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX", 5);
  const windowMs = readPositiveIntEnv(
    "AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS",
    3_600_000,
  );
  const now = Date.now();
  const key = `${intent}:${normalizedEmail}`;
  const prev = pruneTimestamps(
    verificationIntentEmailHits.get(key) ?? [],
    windowMs,
    now,
  );
  if (prev.length >= max) {
    return false;
  }
  prev.push(now);
  verificationIntentEmailHits.set(key, prev);
  return true;
}

export function __resetAuthEmailRateLimitsForTests(): void {
  ipHits.clear();
  verificationIntentEmailHits.clear();
}
