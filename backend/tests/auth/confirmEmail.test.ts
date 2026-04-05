import { describe, it, expect } from "vitest";
import { isValidConfirmEmailTokenInput } from "../../src/auth/confirmEmail.ts";

describe("confirmEmail validation", () => {
  it("isValidConfirmEmailTokenInput rejects empty and non-strings", () => {
    expect(isValidConfirmEmailTokenInput(undefined)).toBe(false);
    expect(isValidConfirmEmailTokenInput(null)).toBe(false);
    expect(isValidConfirmEmailTokenInput(1)).toBe(false);
    expect(isValidConfirmEmailTokenInput("")).toBe(false);
    expect(isValidConfirmEmailTokenInput("   ")).toBe(false);
  });

  it("isValidConfirmEmailTokenInput accepts non-whitespace content", () => {
    expect(isValidConfirmEmailTokenInput("a")).toBe(true);
    expect(isValidConfirmEmailTokenInput("  x  ")).toBe(true);
  });
});
