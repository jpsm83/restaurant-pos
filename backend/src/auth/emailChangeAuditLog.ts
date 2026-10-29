import type { FastifyBaseLogger } from "fastify";

import { appendAuditEntry } from "../audit/appendAuditEntry.ts";
import {
  AUDIT_ACTOR_KINDS,
  AUDIT_TARGET_KINDS,
  type AuditActKind,
} from "../audit/auditCatalogue.ts";

/**
 * Audit trail and failure process logs for the sign-in email change flow.
 *
 * A completed request is recorded on the append-only audit rail attributed to
 * the signed-in User and targeting that User. Every refused or missed request
 * stays a structured process line. Neither home may hold the raw token or the
 * full address.
 */
export const EMAIL_CHANGE_REQUEST_EVENT = "auth.email_change.request";

export type EmailChangeAuditOutcome =
  | "sent"
  | "throttled"
  | "invalid_password"
  | "same_email"
  | "email_taken"
  | "account_not_found"
  | "send_failed"
  | "error"
  | "audit_append_failed";

export interface EmailChangeAuditLine {
  event: string;
  accountId?: string | null;
  outcome: EmailChangeAuditOutcome;
}

const SUCCESS_OUTCOMES: ReadonlySet<EmailChangeAuditOutcome> = new Set([
  "sent",
]);

/** Emits one structured failure line; completed acts go to the audit rail. */
export function logEmailChange(
  logger: FastifyBaseLogger | undefined,
  line: EmailChangeAuditLine,
): void {
  if (!logger || SUCCESS_OUTCOMES.has(line.outcome)) return;

  logger.warn({
    event: line.event,
    accountId: line.accountId ?? null,
    outcome: line.outcome,
  });
}

export interface RecordEmailChangeAuditInput {
  logger?: FastifyBaseLogger;
  event: string;
  accountId: string;
  actKind: AuditActKind;
  outcome: "sent";
}

/**
 * Records a completed email change on the append-only audit rail. A failed
 * append is logged and never undoes the request that already completed.
 */
export async function recordEmailChangeAudit(
  input: RecordEmailChangeAuditInput,
): Promise<void> {
  try {
    const appended = await appendAuditEntry({
      actor: { kind: AUDIT_ACTOR_KINDS.USER, id: input.accountId },
      actKind: input.actKind,
      target: { kind: AUDIT_TARGET_KINDS.USER, id: input.accountId },
      occurredAt: new Date(),
      payload: { outcome: input.outcome },
    });
    if (appended.success) return;
  } catch {
    // A rejected append is logged the same way as a failed result.
  }

  logEmailChange(input.logger, {
    event: input.event,
    accountId: input.accountId,
    outcome: "audit_append_failed",
  });
}
