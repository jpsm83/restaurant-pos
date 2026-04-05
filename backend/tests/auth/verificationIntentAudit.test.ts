import { describe, it, expect, vi, afterEach } from "vitest";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import { logVerificationIntentAudit } from "../../src/auth/verificationIntentAudit.ts";

describe("logVerificationIntentAudit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.SILENCE_VERIFICATION_INTENT_AUDIT = "1";
  });

  it("writes a single JSON line with scope verification_intent_audit", () => {
    process.env.SILENCE_VERIFICATION_INTENT_AUDIT = "0";
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    logVerificationIntentAudit({
      intent: VerificationIntent.EmailConfirmation,
      phase: "consumed",
      subjectKind: "user",
      subjectId: "507f1f77bcf86cd799439011",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0] ?? "");
    expect(line.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(line.trim()) as {
      scope?: string;
      intent?: string;
      phase?: string;
    };
    expect(parsed.scope).toBe("verification_intent_audit");
    expect(parsed.intent).toBe("email_confirmation");
    expect(parsed.phase).toBe("consumed");
  });
});
