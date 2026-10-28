import { describe, it, expect, afterEach, vi } from "vitest";
import {
  AUTH_EMAIL_PATH_CONFIRM_EMAIL,
  AUTH_EMAIL_PATH_RESET_PASSWORD,
  buildConfirmEmailLink,
  buildResetPasswordLink,
  normalizeAppBaseUrl,
  resolveAppBaseUrl,
} from "../../src/auth/emailLinks.ts";

describe("emailLinks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("normalizeAppBaseUrl", () => {
    it("accepts https origin and strips trailing slash on path", () => {
      expect(normalizeAppBaseUrl("https://app.example.com")).toBe(
        "https://app.example.com",
      );
      expect(normalizeAppBaseUrl("https://app.example.com/")).toBe(
        "https://app.example.com",
      );
      expect(normalizeAppBaseUrl("https://app.example.com/pos/")).toBe(
        "https://app.example.com/pos",
      );
    });

    it("rejects non-http(s) and invalid URLs", () => {
      expect(normalizeAppBaseUrl("")).toBeNull();
      expect(normalizeAppBaseUrl("   ")).toBeNull();
      expect(normalizeAppBaseUrl("javascript:alert(1)")).toBeNull();
      expect(normalizeAppBaseUrl("ftp://ex.com")).toBeNull();
      expect(normalizeAppBaseUrl("not-a-url")).toBeNull();
    });
  });

  describe("resolveAppBaseUrl", () => {
    it("uses first valid env in priority order", () => {
      vi.stubEnv("APP_BASE_URL", "https://primary.test");
      vi.stubEnv("PUBLIC_APP_URL", "https://public.test");
      expect(resolveAppBaseUrl()).toBe("https://primary.test");
    });

    it("falls through when earlier values are empty or invalid", () => {
      vi.stubEnv("APP_BASE_URL", "");
      vi.stubEnv("PUBLIC_APP_URL", "javascript:x");
      vi.stubEnv("FRONTEND_URL", "https://fallback.test/path/");
      expect(resolveAppBaseUrl()).toBe("https://fallback.test/path");
    });

    it("throws when nothing usable is set", () => {
      expect(() => resolveAppBaseUrl()).toThrow(
        "no trusted app base URL",
      );
    });
  });

  describe("buildConfirmEmailLink / buildResetPasswordLink", () => {
    it("builds encoded query URLs under the resolved base", () => {
      vi.stubEnv("APP_BASE_URL", "https://app.example.com");
      const tok = "a".repeat(64);
      expect(buildConfirmEmailLink(tok)).toBe(
        `https://app.example.com/${AUTH_EMAIL_PATH_CONFIRM_EMAIL}?token=${encodeURIComponent(tok)}`,
      );
      expect(buildResetPasswordLink(tok)).toBe(
        `https://app.example.com/${AUTH_EMAIL_PATH_RESET_PASSWORD}?token=${encodeURIComponent(tok)}`,
      );
    });

    it("respects path prefix on base URL", () => {
      vi.stubEnv("APP_BASE_URL", "https://app.example.com/my-app");
      const href = buildConfirmEmailLink("abc");
      expect(href).toBe(
        `https://app.example.com/my-app/${AUTH_EMAIL_PATH_CONFIRM_EMAIL}?token=abc`,
      );
    });

    it("rejects empty token", () => {
      vi.stubEnv("APP_BASE_URL", "https://app.example.com");
      expect(() => buildConfirmEmailLink("")).toThrow("Token is required");
      expect(() => buildConfirmEmailLink("   ")).toThrow("Token is required");
    });
  });
});
