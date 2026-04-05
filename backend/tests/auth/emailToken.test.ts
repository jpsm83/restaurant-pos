import { describe, it, expect, afterEach, vi } from "vitest";
import {
  computeEmailVerificationExpiry,
  computeExpiryDate,
  computePasswordResetExpiry,
  DEFAULT_EMAIL_VERIFICATION_TTL_MS,
  DEFAULT_PASSWORD_RESET_TTL_MS,
  generateRawEmailToken,
  getEmailVerificationTtlMs,
  getPasswordResetTtlMs,
  hashEmailToken,
  isAuthTokenExpired,
} from "../../src/auth/emailToken.ts";

describe("emailToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generateRawEmailToken returns 64 hex chars (32 bytes)", () => {
    const t = generateRawEmailToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
    expect(generateRawEmailToken()).not.toBe(t);
  });

  it("hashEmailToken is deterministic and rejects empty input", () => {
    const a = hashEmailToken("  abc  ");
    const b = hashEmailToken("abc");
    expect(a).toBe(b);
    expect(a.length).toBe(64);
    expect(() => hashEmailToken("")).toThrow("Token is required");
    expect(() => hashEmailToken("   ")).toThrow("Token is required");
  });

  it("AUTH_EMAIL_TOKEN_PEPPER changes the digest", () => {
    vi.stubEnv("AUTH_EMAIL_TOKEN_PEPPER", "");
    const withoutPepper = hashEmailToken("same");
    vi.stubEnv("AUTH_EMAIL_TOKEN_PEPPER", "x");
    const withPepper = hashEmailToken("same");
    expect(withPepper).not.toBe(withoutPepper);
  });

  it("getEmailVerificationTtlMs / getPasswordResetTtlMs use env or defaults", () => {
    vi.stubEnv("AUTH_EMAIL_CONFIRM_TTL_MS", "");
    vi.stubEnv("AUTH_RESET_TTL_MS", "");
    expect(getEmailVerificationTtlMs()).toBe(DEFAULT_EMAIL_VERIFICATION_TTL_MS);
    expect(getPasswordResetTtlMs()).toBe(DEFAULT_PASSWORD_RESET_TTL_MS);

    vi.stubEnv("AUTH_EMAIL_CONFIRM_TTL_MS", "120000");
    vi.stubEnv("AUTH_RESET_TTL_MS", "900000");
    expect(getEmailVerificationTtlMs()).toBe(120_000);
    expect(getPasswordResetTtlMs()).toBe(900_000);
  });

  it("ignores invalid TTL env values", () => {
    vi.stubEnv("AUTH_EMAIL_CONFIRM_TTL_MS", "0");
    vi.stubEnv("AUTH_RESET_TTL_MS", "nope");
    expect(getEmailVerificationTtlMs()).toBe(DEFAULT_EMAIL_VERIFICATION_TTL_MS);
    expect(getPasswordResetTtlMs()).toBe(DEFAULT_PASSWORD_RESET_TTL_MS);
  });

  it("computeExpiryDate and phase helpers are in the future", () => {
    const d = computeExpiryDate(60_000);
    expect(d.getTime()).toBeGreaterThan(Date.now());
    expect(computeEmailVerificationExpiry().getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(computePasswordResetExpiry().getTime()).toBeGreaterThan(Date.now());
  });

  it("isAuthTokenExpired", () => {
    expect(isAuthTokenExpired(null)).toBe(true);
    expect(isAuthTokenExpired(undefined)).toBe(true);
    expect(isAuthTokenExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isAuthTokenExpired(new Date(Date.now() + 60_000))).toBe(false);
  });
});
