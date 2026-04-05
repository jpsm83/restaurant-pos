import { describe, it, expect } from "vitest";
import {
  VerificationIntent,
  isVerificationIntent,
} from "../../../packages/authVerificationIntent.ts";

describe("authVerificationIntent (Phase 6.1)", () => {
  it("exposes stable snake_case string values", () => {
    expect(VerificationIntent.EmailConfirmation).toBe("email_confirmation");
    expect(VerificationIntent.PasswordReset).toBe("password_reset");
    expect(VerificationIntent.ChangePasswordConfirmation).toBe(
      "change_password_confirmation",
    );
    expect(VerificationIntent.ChangeEmailConfirmation).toBe(
      "change_email_confirmation",
    );
    expect(VerificationIntent.HighRiskActionConfirmation).toBe(
      "high_risk_action_confirmation",
    );
  });

  it("isVerificationIntent accepts only defined intents", () => {
    expect(isVerificationIntent("email_confirmation")).toBe(true);
    expect(isVerificationIntent("password_reset")).toBe(true);
    expect(isVerificationIntent("unknown_intent")).toBe(false);
    expect(isVerificationIntent("")).toBe(false);
  });
});
