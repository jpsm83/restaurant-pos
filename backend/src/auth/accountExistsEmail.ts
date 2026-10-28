import emailChannel from "../communications/channels/emailChannel.ts";
import { buildForgotPasswordLink, buildSignInLink } from "./emailLinks.ts";
import { buildAccountExistsEmailContent } from "./emailTemplates.ts";

/**
 * Sign-up anti-enumeration message for an address that already has an account.
 * Best-effort: sign-up always returns its generic outcome, so a delivery
 * failure is logged by the caller rather than surfaced to the requester.
 */
export async function sendAccountExistsEmail(options: {
  to: string;
  greetingName?: string;
}): Promise<boolean> {
  try {
    const content = buildAccountExistsEmailContent({
      signInUrl: buildSignInLink(),
      resetUrl: buildForgotPasswordLink(),
      greetingName: options.greetingName,
    });
    const result = await emailChannel.send({
      to: options.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return result.success === true;
  } catch {
    return false;
  }
}
