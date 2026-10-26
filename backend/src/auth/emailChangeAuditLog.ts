import type { FastifyBaseLogger } from "fastify";

import { appendAuditEntry } from "../audit/appendAuditEntry.ts";
import {
  AUDIT_ACTOR_KINDS,
  AUDIT_TARGET_KINDS,
  type AuditActKind,
} from "../audit/auditCatalogue.ts";

/**
 * Failure process logs for the sign-in email change flow.
 *
 * Success is recorded on the append-only audit rail instead, so `sent` and
 * `confirmed` write no process-log line here. Every line carries the account id
 * and outcome without ever holding the raw token or the full address.
 */
export const EMAIL_CHANGE_REQUEST_EVENT = "auth.email_change.request";
export const EMAIL_CHANGE_CONFIRM_EVENT = "auth.email_change.confirm";

export type EmailChangeAuditOutcome =
  | "sent"
  | "throttled"
  | "invalid_password"
  | "same_email"
  | "email_taken"
  | "account_not_found"
  | "send_failed"
  | "confirmed"
  | "invalid_token"
  | "error"
  | "audit_append_failed";

export interface EmailChangeAuditLine {
  event: string;
  accountId?: string | null;
  outcome: EmailChangeAuditOutcome;
}

const SUCCESS_OUTCOMES: ReadonlySet<EmailChangeAuditOutcome> = new Set([
  "sent",
  "confirmed",
]);

/** Emits one structured failure line; success outcomes are audit entries now. */
export function logEmailChange(
  logger: FastifyBaseLogger | undefined,
  line: EmailChangeAuditLine,
): void {
  if (!logger) return;
  if (SUCCESS_OUTCOMES.has(line.outcome)) return;

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
  outcome: "sent" | "confirmed";
}

/**
 * Records a completed email change on the append-only audit rail, attributed to
 * and targeting the Business. A failed append is logged and never undoes the
 * change that already completed.
 */
export async function recordEmailChangeAudit(
  input: RecordEmailChangeAuditInput,
): Promise<void> {
  try {
    const appended = await appendAuditEntry({
      actor: { kind: AUDIT_ACTOR_KINDS.BUSINESS, id: input.accountId },
      actKind: input.actKind,
      target: { kind: AUDIT_TARGET_KINDS.BUSINESS, id: input.accountId },
      businessId: input.accountId,
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
