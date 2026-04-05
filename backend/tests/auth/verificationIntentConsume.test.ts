import { describe, it, expect } from "vitest";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import { consumeVerificationIntent } from "../../src/auth/verificationIntentConsume.ts";

describe("consumeVerificationIntent", () => {
  it("returns server_error for unsupported intents", async () => {
    const r = await consumeVerificationIntent(
      VerificationIntent.HighRiskActionConfirmation,
      { token: "any" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("server_error");
    }
  });
});
