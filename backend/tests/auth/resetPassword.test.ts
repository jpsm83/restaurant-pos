import { describe, it, expect } from "vitest";
import {
  isValidResetPasswordNewPasswordInput,
  isValidResetPasswordTokenInput,
} from "../../src/auth/resetPassword.ts";

describe("resetPassword validation", () => {
  it("isValidResetPasswordTokenInput rejects empty and non-strings", () => {
    expect(isValidResetPasswordTokenInput(undefined)).toBe(false);
    expect(isValidResetPasswordTokenInput("")).toBe(false);
    expect(isValidResetPasswordTokenInput("   ")).toBe(false);
  });

  it("isValidResetPasswordNewPasswordInput rejects empty and non-strings", () => {
    expect(isValidResetPasswordNewPasswordInput(undefined)).toBe(false);
    expect(isValidResetPasswordNewPasswordInput("")).toBe(false);
  });

  it("accepts non-empty trimmed inputs", () => {
    expect(isValidResetPasswordTokenInput("abc")).toBe(true);
    expect(isValidResetPasswordNewPasswordInput(" x ")).toBe(true);
  });
});
