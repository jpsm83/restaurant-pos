import emailChannel from "../communications/channels/emailChannel.ts";
import { buildSignInConfirmationContent } from "./emailTemplates.ts";

interface SignInConfirmationLogger {
  error: (payload: Record<string, unknown>, message: string) => void;
}

/**
 * One shared sign-in security notice for every sign-in path. It carries no
 * link, token, or stored state, so a failed send is logged and dropped without
 * touching the issued session.
 */
export async function sendSignInConfirmationEmail(options: {
  to: string;
  greetingName?: string;
  language?: string | null;
  logger?: SignInConfirmationLogger;
}): Promise<boolean> {
  try {
    const content = buildSignInConfirmationContent({
      greetingName: options.greetingName,
      language: options.language,
    });
    const result = await emailChannel.send({
      to: options.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    if (!result.success) {
      options.logger?.error(
        { errHint: "signin_confirmation_send", error: result.error },
        "Sign-in confirmation email failed",
      );
      return false;
    }

    return true;
  } catch (error) {
    options.logger?.error(
      { errHint: "signin_confirmation_send", error },
      "Sign-in confirmation email failed",
    );
    return false;
  }
}
