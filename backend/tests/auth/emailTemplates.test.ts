import { describe, it, expect } from "vitest";
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

  it("returns a short time phrase for non-positive TTL", () => {
    expect(formatAuthEmailTtlPhrase(0)).toBe("a short time");
    expect(formatAuthEmailTtlPhrase(-1)).toBe("a short time");
  });
});

describe("emailTemplates", () => {
  it("buildEmailConfirmationContent includes link, fixed copy, and greeting", () => {
    const url = "https://app.test/confirm-email?token=abc";
    const { subject, html, text } = buildEmailConfirmationContent({
      confirmUrl: url,
      greetingName: "Pat",
    });

    expect(subject).toBe("Confirm Your Email - Restaurant POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("24 hours");
    expect(html).toContain("Hello Pat!");
    expect(html).not.toContain("<script>");
    expect(text).toContain(url);
    expect(text).toContain("24 hours");
    expect(text).toContain("Hello Pat!");
  });

  it("uses a neutral greeting when name is missing", () => {
    const { html, text } = buildEmailConfirmationContent({
      confirmUrl: "https://x.test/c",
    });
    expect(html).toContain("Hello there!");
    expect(text).toContain("Hello there!");
  });

  it("buildPasswordResetEmailContent includes link and fixed expiry copy", () => {
    const url = "https://app.test/reset-password?token=xyz";
    const { subject, html, text } = buildPasswordResetEmailContent({
      resetUrl: url,
    });

    expect(subject).toBe("Password Reset Request - Restaurant POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("1 hour");
    expect(text).toContain(url);
    expect(text).toContain("1 hour");
  });
});
