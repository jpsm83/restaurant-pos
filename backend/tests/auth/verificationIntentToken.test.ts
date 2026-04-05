import { describe, it, expect } from "vitest";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import { createIntentTokenForVerificationIntent } from "../../src/auth/verificationIntentToken.ts";

describe("createIntentTokenForVerificationIntent", () => {
  it("issues distinct raw tokens and matching hashes for confirmation", () => {
    const a = createIntentTokenForVerificationIntent(
      VerificationIntent.EmailConfirmation,
    );
    const b = createIntentTokenForVerificationIntent(
      VerificationIntent.EmailConfirmation,
    );
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws for intents without V1 issuance", () => {
    expect(() =>
      createIntentTokenForVerificationIntent(
        VerificationIntent.ChangePasswordConfirmation,
      ),
    ).toThrow(/not implemented/i);
  });
});
