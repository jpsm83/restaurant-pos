import bcrypt from "bcrypt";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "./confirmEmail.ts";
import {
  recordAuthEmailTokenConsumed,
  recordAuthEmailTokenConsumeFailed,
  recordAuthEmailTokenRejected,
} from "./authEmailMetrics.ts";
import { hashEmailToken } from "./emailToken.ts";
import { logVerificationIntentAudit } from "./verificationIntentAudit.ts";

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Your password has been reset successfully.";

export const RESET_PASSWORD_MISSING_TOKEN_MESSAGE =
  "Please provide a reset token.";

export const RESET_PASSWORD_MISSING_NEW_PASSWORD_MESSAGE =
  "Please provide a new password.";

export function isValidResetPasswordTokenInput(
  token: unknown,
): token is string {
  return typeof token === "string" && token.trim().length > 0;
}

export function isValidResetPasswordNewPasswordInput(
  newPassword: unknown,
): newPassword is string {
  return typeof newPassword === "string" && newPassword.trim().length > 0;
}

export type ResetPasswordResult =
  | { kind: "success"; message: string }
  | { kind: "client_error"; message: string }
  | { kind: "server_error"; message: string };

const RESET_INTENT = VerificationIntent.PasswordReset;

/**
 * **Business first**, then **user**. Atomically sets password, clears reset token fields when hash matches and expiry is valid.
 */
export async function handleResetPassword(
  token: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const raw = token.trim();
  const plain = newPassword.trim();

  let tokenHash: string;
  try {
    tokenHash = hashEmailToken(raw);
  } catch {
    recordAuthEmailTokenRejected("password_reset");
    logVerificationIntentAudit({
      intent: RESET_INTENT,
      phase: "consume_rejected",
      rejectReason: "invalid_token",
    });
    return {
      kind: "client_error",
      message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    };
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(plain, 10);

  try {
    const business = await Business.findOneAndUpdate(
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: now },
      },
      {
        $set: { password: passwordHash },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpiresAt: "",
        },
        $inc: { refreshSessionVersion: 1 },
      },
      { returnDocument: "after" },
    ).lean();

    if (business) {
      recordAuthEmailTokenConsumed("password_reset");
      logVerificationIntentAudit({
        intent: RESET_INTENT,
        phase: "consumed",
        subjectKind: "business",
        subjectId: String(business._id),
      });
      return { kind: "success", message: RESET_PASSWORD_SUCCESS_MESSAGE };
    }

    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: now },
      },
      {
        $set: { "personalDetails.password": passwordHash },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpiresAt: "",
        },
        $inc: { refreshSessionVersion: 1 },
      },
      { returnDocument: "after" },
    ).lean();

    if (user) {
      recordAuthEmailTokenConsumed("password_reset");
      logVerificationIntentAudit({
        intent: RESET_INTENT,
        phase: "consumed",
        subjectKind: "user",
        subjectId: String(user._id),
      });
      return { kind: "success", message: RESET_PASSWORD_SUCCESS_MESSAGE };
    }

    recordAuthEmailTokenRejected("password_reset");
    logVerificationIntentAudit({
      intent: RESET_INTENT,
      phase: "consume_rejected",
      rejectReason: "not_found_or_expired",
    });
    return {
      kind: "client_error",
      message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    };
  } catch {
    recordAuthEmailTokenConsumeFailed("password_reset");
    logVerificationIntentAudit({
      intent: RESET_INTENT,
      phase: "consume_failed",
      rejectReason: "server",
    });
    return {
      kind: "server_error",
      message: "Unable to complete this request. Please try again later.",
    };
  }
}
