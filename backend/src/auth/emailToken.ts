import crypto from "node:crypto";

/** Locked in `TODO-auth-email-security-flows-implementation.md` Phase 0 (24h). */
export const DEFAULT_EMAIL_VERIFICATION_TTL_MS = 86_400_000;

/** Locked in Phase 0 (60m). */
export const DEFAULT_PASSWORD_RESET_TTL_MS = 3_600_000;

function readPositiveIntMs(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function getEmailVerificationTtlMs(): number {
  return readPositiveIntMs(
    "AUTH_EMAIL_CONFIRM_TTL_MS",
    DEFAULT_EMAIL_VERIFICATION_TTL_MS,
  );
}

export function getPasswordResetTtlMs(): number {
  return readPositiveIntMs(
    "AUTH_RESET_TTL_MS",
    DEFAULT_PASSWORD_RESET_TTL_MS,
  );
}

function tokenPepper(): string {
  return process.env.AUTH_EMAIL_TOKEN_PEPPER?.trim() ?? "";
}

/**
 * Raw opaque token for email links (64 hex chars = 32 random bytes).
 * Store only {@link hashEmailToken} in MongoDB.
 */
export function generateRawEmailToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * SHA-256 hex digest of `rawToken + AUTH_EMAIL_TOKEN_PEPPER` (pepper optional).
 * Lookup path: hash incoming token → `findOne({ *TokenHash: digest })` (no plaintext compare).
 */
export function hashEmailToken(rawToken: string): string {
  const normalized = rawToken.trim();
  if (!normalized) {
    throw new Error("Token is required");
  }
  return crypto
    .createHash("sha256")
    .update(normalized + tokenPepper(), "utf8")
    .digest("hex");
}

export function computeExpiryDate(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

export function computeEmailVerificationExpiry(): Date {
  return computeExpiryDate(getEmailVerificationTtlMs());
}

export function computePasswordResetExpiry(): Date {
  return computeExpiryDate(getPasswordResetTtlMs());
}

/** True if missing or not strictly after `Date.now()` (treat absent expiry as invalid). */
export function isAuthTokenExpired(expiresAt: Date | undefined | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}
