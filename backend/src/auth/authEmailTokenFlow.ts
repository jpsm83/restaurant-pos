import crypto from "crypto";
import emailChannel from "../communications/channels/emailChannel.ts";
import type { AuthEmailTemplateContent } from "./emailTemplates.ts";

/**
 * One-time-link mail on the delivery rail. Persists the token, sends that one
 * address the template's plain and rich parts, and clears the pending link when
 * the rail reports failure. Returns `false` so the caller can map it to the
 * server error it already returns. The operational-email switch does not apply:
 * this calls the rail directly.
 */
export async function sendAuthTokenEmailOrRollback(options: {
  to: string;
  persist: (token: string) => Promise<unknown>;
  buildLink: (token: string) => string;
  buildContent: (link: string) => AuthEmailTemplateContent;
  rollback: () => Promise<unknown>;
}): Promise<boolean> {
  const token = crypto.randomBytes(32).toString("hex");
  await options.persist(token);

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
      return false;
    }
    return true;
  } catch {
    await options.rollback();
    return false;
  }
}
