import type { FastifyBaseLogger } from "fastify";

/**
 * Structured audit lines for the sign-in email change flow.
 *
 * Every line carries the account id and outcome so support can trace a request
 * without ever holding the raw token or the full address: the payload never
 * accepts either.
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
  | "error";

export interface EmailChangeAuditLine {
  event: string;
  accountId?: string | null;
  outcome: EmailChangeAuditOutcome;
}

const SUCCESS_OUTCOMES: ReadonlySet<EmailChangeAuditOutcome> = new Set([
  "sent",
  "confirmed",
]);

/** Emits one structured line; success at info, every other outcome at warn. */
export function logEmailChange(
  logger: FastifyBaseLogger | undefined,
  line: EmailChangeAuditLine,
): void {
  if (!logger) return;

  const payload = {
    event: line.event,
    accountId: line.accountId ?? null,
    outcome: line.outcome,
  };

  if (SUCCESS_OUTCOMES.has(line.outcome)) {
    logger.info(payload);
  } else {
    logger.warn(payload);
  }
}
