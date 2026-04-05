import type { VerificationIntent } from "../../../packages/authVerificationIntent.ts";

/**
 * Line-delimited JSON for log aggregators. Never include raw tokens or passwords.
 */
export type VerificationIntentAuditPhase =
  | "issue_skipped"
  | "token_persisted"
  | "delivery_failed"
  | "delivered"
  | "consumed"
  | "consume_rejected"
  | "consume_failed";

export type VerificationIntentIssueSkipReason =
  | "no_account"
  | "already_verified"
  | "rate_limited";

/** Why consume was rejected (no raw tokens in logs). */
export type VerificationIntentConsumeRejectReason =
  | "invalid_token"
  | "not_found_or_expired"
  | "server";

export type VerificationIntentAuditEvent = {
  intent: VerificationIntent;
  phase: VerificationIntentAuditPhase;
  correlationId?: string;
  subjectKind?: "business" | "user";
  /** Mongo ObjectId string only; no emails in audit lines. */
  subjectId?: string;
  skipReason?: VerificationIntentIssueSkipReason;
  rejectReason?: VerificationIntentConsumeRejectReason;
};

/**
 * Emits one JSON line to stdout. Safe to call from auth helpers without Fastify `req`.
 */
export function logVerificationIntentAudit(
  event: VerificationIntentAuditEvent,
): void {
  if (process.env.SILENCE_VERIFICATION_INTENT_AUDIT === "1") {
    return;
  }
  const line = JSON.stringify({
    scope: "verification_intent_audit",
    ts: new Date().toISOString(),
    ...event,
  });
  process.stdout.write(`${line}\n`);
}
