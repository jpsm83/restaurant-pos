import emailChannel from "../communications/channels/emailChannel.ts";
import {
  recordAuthEmailDispatchFailure,
  recordAuthEmailDispatchSuccess,
} from "./authEmailMetrics.ts";
import type { AuthEmailTemplateContent } from "./emailTemplates.ts";

/**
 * Sends a transactional auth email through the shared communications SMTP path.
 * Uses `fireAndForget: true` on the channel so we always get a result object, then throws if send failed
 * (SMTP disabled, validation error, or transport error after retries).
 *
 * On failure, callers that already persisted tokens should run their **rollback** (see {@link sendAuthTransactionalEmailWithRollback}).
 */
export async function sendAuthTransactionalEmail(options: {
  to: string;
  content: AuthEmailTemplateContent;
  correlationId?: string;
}): Promise<void> {
  const to = options.to.trim();
  if (!to) {
    throw new Error("Recipient email is required");
  }

  const { subject, text, html } = options.content;
  const result = await emailChannel.send({
    to,
    subject,
    text,
    html,
    correlationId: options.correlationId,
    // Avoid throws inside emailChannel so we always branch on `success` and surface one error type to callers.
    fireAndForget: true,
  });

  if (!result.success) {
    recordAuthEmailDispatchFailure();
    throw new Error(
      result.error ?? "Failed to send transactional email",
    );
  }
  recordAuthEmailDispatchSuccess();
}

/**
 * Sends the email; on any failure runs `rollback` once (e.g. clear issued token fields) then rethrows.
 */
export async function sendAuthTransactionalEmailWithRollback(options: {
  to: string;
  content: AuthEmailTemplateContent;
  correlationId?: string;
  rollback: () => Promise<void>;
}): Promise<void> {
  try {
    await sendAuthTransactionalEmail({
      to: options.to,
      content: options.content,
      correlationId: options.correlationId,
    });
  } catch (error) {
    await options.rollback();
    throw error;
  }
}
