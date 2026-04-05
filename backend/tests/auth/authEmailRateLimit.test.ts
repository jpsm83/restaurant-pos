import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import {
  checkAuthEmailIpRate,
  tryConsumeVerificationIntentEmailSlot,
  __resetAuthEmailRateLimitsForTests,
} from "../../src/auth/authEmailRateLimit.ts";

describe("authEmailRateLimit", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    __resetAuthEmailRateLimitsForTests();
    savedEnv.AUTH_EMAIL_RATE_LIMIT_IP_MAX = process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX;
    savedEnv.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS =
      process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS;
    savedEnv.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX =
      process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX;
    savedEnv.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS =
      process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS;
  });

  afterEach(() => {
    __resetAuthEmailRateLimitsForTests();
    for (const key of Object.keys(savedEnv)) {
      const v = savedEnv[key as keyof typeof savedEnv];
      if (v === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = v;
      }
    }
  });

  it("checkAuthEmailIpRate allows up to max then blocks", () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX = "2";
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS = "3600000";

    expect(
      checkAuthEmailIpRate("request-email-confirmation", "10.0.0.1"),
    ).toEqual({ allowed: true });
    expect(
      checkAuthEmailIpRate("request-email-confirmation", "10.0.0.1"),
    ).toEqual({ allowed: true });
    expect(
      checkAuthEmailIpRate("request-email-confirmation", "10.0.0.1"),
    ).toEqual({ allowed: false });
  });

  it("checkAuthEmailIpRate uses separate buckets per route", () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX = "1";
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS = "3600000";

    expect(
      checkAuthEmailIpRate("request-email-confirmation", "10.0.0.2"),
    ).toEqual({ allowed: true });
    expect(
      checkAuthEmailIpRate("request-email-confirmation", "10.0.0.2"),
    ).toEqual({ allowed: false });

    expect(
      checkAuthEmailIpRate("request-password-reset", "10.0.0.2"),
    ).toEqual({ allowed: true });

    expect(
      checkAuthEmailIpRate("resend-email-confirmation", "10.0.0.2"),
    ).toEqual({ allowed: true });
  });

  it("tryConsumeVerificationIntentEmailSlot allows up to max per intent then returns false", () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX = "2";
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS = "3600000";

    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.EmailConfirmation,
        "a@b.com",
      ),
    ).toBe(true);
    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.EmailConfirmation,
        "a@b.com",
      ),
    ).toBe(true);
    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.EmailConfirmation,
        "a@b.com",
      ),
    ).toBe(false);
  });

  it("tryConsumeVerificationIntentEmailSlot uses separate buckets per intent", () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX = "1";
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS = "3600000";

    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.EmailConfirmation,
        "shared@example.com",
      ),
    ).toBe(true);
    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.EmailConfirmation,
        "shared@example.com",
      ),
    ).toBe(false);

    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.PasswordReset,
        "shared@example.com",
      ),
    ).toBe(true);
    expect(
      tryConsumeVerificationIntentEmailSlot(
        VerificationIntent.PasswordReset,
        "shared@example.com",
      ),
    ).toBe(false);
  });
});
