import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import {
  recordAuthEmailTokenConsumed,
  recordAuthEmailTokenConsumeFailed,
  recordAuthEmailTokenRejected,
} from "./authEmailMetrics.ts";
import { hashEmailToken } from "./emailToken.ts";
import { logVerificationIntentAudit } from "./verificationIntentAudit.ts";

export const CONFIRM_EMAIL_SUCCESS_MESSAGE =
  "Your email has been verified successfully.";

/** Phase 0: single message for invalid / expired / already used / already verified (no oracle). */
export const CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE =
  "This link is invalid or has expired. Please request a new one.";

export const CONFIRM_EMAIL_MISSING_TOKEN_MESSAGE =
  "Please provide a confirmation token.";

export function isValidConfirmEmailTokenInput(
  token: unknown,
): token is string {
  return typeof token === "string" && token.trim().length > 0;
}

export type ConfirmEmailResult =
  | { kind: "success"; message: string }
  | { kind: "client_error"; message: string }
  | { kind: "server_error"; message: string };

const verificationSuccessUpdate = {
  $set: { emailVerified: true },
  $unset: {
    emailVerificationTokenHash: "",
    emailVerificationExpiresAt: "",
  },
} as const;

const CONFIRM_INTENT = VerificationIntent.EmailConfirmation;

/**
 * **Business first**, then **user**, matching login / request-confirmation priority.
 * One-time use: atomic `findOneAndUpdate` clears hash + expiry only when token matches, not expired, and not already verified.
 */
export async function handleConfirmEmail(
  token: string,
): Promise<ConfirmEmailResult> {
  const raw = token.trim();
  let tokenHash: string;
  try {
    tokenHash = hashEmailToken(raw);
  } catch {
    recordAuthEmailTokenRejected("email_confirmation");
    logVerificationIntentAudit({
      intent: CONFIRM_INTENT,
      phase: "consume_rejected",
      rejectReason: "invalid_token",
    });
    return {
      kind: "client_error",
      message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    };
  }

  const now = new Date();

  try {
    const business = await Business.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerified: { $ne: true },
        emailVerificationExpiresAt: { $gt: now },
      },
      verificationSuccessUpdate,
      { returnDocument: "after" },
    ).lean();

    if (business) {
      recordAuthEmailTokenConsumed("email_confirmation");
      logVerificationIntentAudit({
        intent: CONFIRM_INTENT,
        phase: "consumed",
        subjectKind: "business",
        subjectId: String(business._id),
      });
      return { kind: "success", message: CONFIRM_EMAIL_SUCCESS_MESSAGE };
    }

    const user = await User.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerified: { $ne: true },
        emailVerificationExpiresAt: { $gt: now },
      },
      verificationSuccessUpdate,
      { returnDocument: "after" },
    ).lean();

    if (user) {
      recordAuthEmailTokenConsumed("email_confirmation");
      logVerificationIntentAudit({
        intent: CONFIRM_INTENT,
        phase: "consumed",
        subjectKind: "user",
        subjectId: String(user._id),
      });
      return { kind: "success", message: CONFIRM_EMAIL_SUCCESS_MESSAGE };
    }

    recordAuthEmailTokenRejected("email_confirmation");
    logVerificationIntentAudit({
      intent: CONFIRM_INTENT,
      phase: "consume_rejected",
      rejectReason: "not_found_or_expired",
    });
    return {
      kind: "client_error",
      message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    };
  } catch {
    recordAuthEmailTokenConsumeFailed("email_confirmation");
    logVerificationIntentAudit({
      intent: CONFIRM_INTENT,
      phase: "consume_failed",
      rejectReason: "server",
    });
    return {
      kind: "server_error",
      message: "Unable to complete this request. Please try again later.",
    };
  }
}
