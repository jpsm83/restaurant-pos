import type { FastifyBaseLogger } from "fastify";
import emailChannel from "../communications/channels/emailChannel.ts";
import Business from "../models/business.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "./confirmEmail.ts";
import {
  EMAIL_CHANGE_CONFIRM_EVENT,
  logEmailChange,
  type EmailChangeAuditOutcome,
} from "./emailChangeAuditLog.ts";
import { buildEmailChangeNoticeContent } from "./emailTemplates.ts";

export const CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE =
  "Your sign-in email has been updated. Please sign in again.";

export type ConfirmEmailChangeResult =
  | { kind: "success_200"; message: string }
  | { kind: "client_error"; message: string }
  | { kind: "server_error_500"; message: string };

/**
 * Consumes a pending sign-in email change token (one-time).
 *
 * Atomically matches the pending token against an unexpired expiry, then swaps
 * the sign-in email to the pending address, marks it verified, clears the
 * pending fields, and bumps `refreshSessionVersion` so existing refresh tokens
 * stop working. A security notice then goes to the previous address on the
 * delivery rail. That send is best-effort: a failure leaves the stored change
 * in place and still confirms.
 *
 * Invalid, expired, unknown, or already-used tokens all return the same
 * non-revealing message so account state is not leaked.
 */
export async function handleConfirmEmailChange(
  token: string,
  logger?: FastifyBaseLogger,
): Promise<ConfirmEmailChangeResult> {
  // Stored tokens are lowercase hex; normalize so links still work if the
  // client uppercases the query param.
  const pendingEmailToken = token.trim().toLowerCase();
  const now = new Date();

  // Known only once the pending record is found; a null id marks an unknown token.
  let accountId: string | null = null;
  const audit = (outcome: EmailChangeAuditOutcome) =>
    logEmailChange(logger, {
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId,
      outcome,
    });

  try {
    const pending = await Business.findOne({
      pendingEmailToken,
      pendingEmailExpires: { $gt: now },
    })
      .select("_id email tradeName pendingEmail")
      .lean();

    if (!pending || !pending.pendingEmail) {
      audit("invalid_token");
      return {
        kind: "client_error",
        message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      };
    }

    accountId = String(pending._id);

    const result = await Business.updateOne(
      {
        _id: pending._id,
        pendingEmailToken,
        pendingEmailExpires: { $gt: now },
      },
      {
        $set: { email: pending.pendingEmail, emailVerified: true },
        $unset: {
          pendingEmail: "",
          pendingEmailToken: "",
          pendingEmailExpires: "",
          pendingEmailRequestedAt: "",
        },
        $inc: { refreshSessionVersion: 1 },
      },
    );

    if (result.matchedCount === 0) {
      audit("invalid_token");
      return {
        kind: "client_error",
        message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      };
    }

    const previousEmail = String(pending.email ?? "").trim();
    if (previousEmail) {
      const content = buildEmailChangeNoticeContent({
        newEmail: pending.pendingEmail,
        greetingName: pending.tradeName?.trim() || undefined,
      });
      await emailChannel.send({
        to: previousEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    }

    audit("confirmed");

    return {
      kind: "success_200",
      message: CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE,
    };
  } catch {
    audit("error");
    return {
      kind: "server_error_500",
      message: "Unable to complete this request. Please try again later.",
    };
  }
}
