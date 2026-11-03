import crypto from "crypto";
import emailChannel from "../communications/channels/emailChannel.ts";
import type { AuthEmailTemplateContent } from "./emailTemplates.ts";

/** How long a sign-in email confirmation link stays valid. */
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** How long a password reset link stays valid. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export type AuthTokenEmailOutcome = "sent" | "failed" | "skipped";

/**
 * One-time-link mail on the delivery rail. Persists the token, sends that one
 * address the template's plain and rich parts, and clears the pending link when
 * the rail reports failure. `persist` returns `false` when another request owns
 * the send slot, so nothing is sent or rolled back. The operational-email
 * switch does not apply: this calls the rail directly.
 */
export async function sendAuthTokenEmailOrRollback(options: {
  to: string;
  persist: (token: string) => Promise<boolean>;
  buildLink: (token: string) => string;
  buildContent: (link: string) => AuthEmailTemplateContent;
  rollback: () => Promise<unknown>;
}): Promise<AuthTokenEmailOutcome> {
  const token = crypto.randomBytes(32).toString("hex");
  if (!(await options.persist(token))) {
    return "skipped";
  }

  try {
    const link = options.buildLink(token);
    const content = options.buildContent(link);
    const result = await emailChannel.send({
      to: options.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    if (!result.success) {
      await options.rollback();
      return "failed";
    }
    return "sent";
  } catch {
    await options.rollback();
    return "failed";
  }
}
