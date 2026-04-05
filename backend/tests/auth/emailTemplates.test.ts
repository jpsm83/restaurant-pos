import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildEmailConfirmationContent,
  buildPasswordResetEmailContent,
  formatAuthEmailTtlPhrase,
} from "../../src/auth/emailTemplates.ts";

describe("formatAuthEmailTtlPhrase", () => {
  it("formats minutes under one hour", () => {
    expect(formatAuthEmailTtlPhrase(60_000)).toBe("1 minute");
    expect(formatAuthEmailTtlPhrase(120_000)).toBe("2 minutes");
  });

  it("formats whole hours when exact", () => {
    expect(formatAuthEmailTtlPhrase(3_600_000)).toBe("1 hour");
    expect(formatAuthEmailTtlPhrase(86_400_000)).toBe("24 hours");
  });

  it("formats hour and minute remainder", () => {
    expect(formatAuthEmailTtlPhrase(5_400_000)).toBe("1 hour and 30 minutes");
  });
});

describe("emailTemplates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("buildEmailConfirmationContent includes link, TTL from env, brand, and fallback URL in text", () => {
    vi.stubEnv("AUTH_EMAIL_BRAND_NAME", "Test Brand");
    vi.stubEnv("AUTH_EMAIL_CONFIRM_TTL_MS", "7200000");
    const url = "https://app.test/confirm-email?token=abc";
    const { subject, html, text } = buildEmailConfirmationContent({
      confirmUrl: url,
      greetingName: "Pat",
    });

    expect(subject).toBe("Confirm your email — Test Brand");
    expect(html).toContain('href="' + url + '"');
    expect(html).toContain("2 hours");
    expect(html).toContain("https://app.test/confirm-email?token=abc");
    expect(html).toContain("Pat,");
    expect(html).not.toContain("<script>");
    expect(text).toContain(url);
    expect(text).toContain("2 hours");
    expect(text).toContain("Pat,");
  });

  it("escapes greetingName in HTML", () => {
    vi.stubEnv("AUTH_EMAIL_BRAND_NAME", "App");
    const { html } = buildEmailConfirmationContent({
      confirmUrl: "https://x.test/c",
      greetingName: '<b>evil</b>',
    });
    expect(html).toContain("&lt;b&gt;evil&lt;/b&gt;");
    expect(html).not.toContain("<b>evil</b>");
  });

  it("buildPasswordResetEmailContent includes link and reset TTL", () => {
    vi.stubEnv("AUTH_EMAIL_BRAND_NAME", "POS");
    vi.stubEnv("AUTH_RESET_TTL_MS", "1800000");
    const url = "https://app.test/reset-password?token=xyz";
    const { subject, html, text } = buildPasswordResetEmailContent({
      resetUrl: url,
    });

    expect(subject).toBe("Reset your password — POS");
    expect(html).toContain('href="' + url + '"');
    expect(html).toContain("30 minutes");
    expect(text).toContain(url);
    expect(text).toContain("30 minutes");
  });

  it("defaults brand when AUTH_EMAIL_BRAND_NAME unset", () => {
    const { subject } = buildEmailConfirmationContent({
      confirmUrl: "https://x.test/c",
    });
    expect(subject).toContain("Restaurant POS");
  });
});
