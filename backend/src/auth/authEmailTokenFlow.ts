import crypto from "crypto";
import { sendAuthTransactionalEmail } from "./authEmailSend.ts";
import type { AuthEmailTemplateContent } from "./emailTemplates.ts";

/**
 * Shared one-time-token email flow for the auth modules: generate a CSPRNG
 * token, persist it, build and email the link, and run the caller's rollback if
 * the send fails. Returns `false` after a rolled-back failure so the caller can
 * map it to its own `server_error_500` result.
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
    await sendAuthTransactionalEmail({
      to: options.to,
      content: options.buildContent(link),
    });
    return true;
  } catch {
    await options.rollback();
    return false;
  }
}
