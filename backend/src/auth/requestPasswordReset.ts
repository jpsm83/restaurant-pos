import type { Types } from "mongoose";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { sendAuthTransactionalEmailWithRollback } from "./authEmailSend.ts";
import { tryConsumeVerificationIntentEmailSlot } from "./authEmailRateLimit.ts";
import { buildResetPasswordLink } from "./emailLinks.ts";
import { buildPasswordResetEmailContent } from "./emailTemplates.ts";
import { logVerificationIntentAudit } from "./verificationIntentAudit.ts";
import { createIntentTokenForVerificationIntent } from "./verificationIntentToken.ts";

export type RequestPasswordResetHandlerResult =
  | { kind: "generic_200" }
  | {
      kind: "server_error_500";
      message: string;
    };

const PASSWORD_RESET_INTENT = VerificationIntent.PasswordReset;

/**
 * **Business first**, then **user** (login order). Issues password-reset token + sends email when an account exists.
 * Unknown email → generic success without send. Per-email cap is **per intent** (Phase 6), separate from email confirmation.
 */
export async function handleRequestPasswordReset(
  normalizedEmail: string,
): Promise<RequestPasswordResetHandlerResult> {
  const business = await Business.findOne({ email: normalizedEmail })
    .select("_id tradeName email")
    .lean();

  const user =
    business == null
      ? await User.findOne({ "personalDetails.email": normalizedEmail })
          .select(
            "_id personalDetails.username personalDetails.firstName personalDetails.email",
          )
          .lean()
      : null;

  if (!business && !user) {
    logVerificationIntentAudit({
      intent: PASSWORD_RESET_INTENT,
      phase: "issue_skipped",
      skipReason: "no_account",
    });
    return { kind: "generic_200" };
  }

  if (!tryConsumeVerificationIntentEmailSlot(PASSWORD_RESET_INTENT, normalizedEmail)) {
    logVerificationIntentAudit({
      intent: PASSWORD_RESET_INTENT,
      phase: "issue_skipped",
      skipReason: "rate_limited",
    });
    return { kind: "generic_200" };
  }

  const { rawToken, tokenHash, expiresAt } =
    createIntentTokenForVerificationIntent(PASSWORD_RESET_INTENT);

  if (business) {
    const businessId = business._id as Types.ObjectId;
    const correlationId = `pwd-reset-business:${String(businessId)}`;
    await Business.updateOne(
      { _id: businessId },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      },
    );

    logVerificationIntentAudit({
      intent: PASSWORD_RESET_INTENT,
      phase: "token_persisted",
      correlationId,
      subjectKind: "business",
      subjectId: String(businessId),
    });

    const rollbackBusinessResetFields = async () => {
      await Business.updateOne(
        { _id: businessId },
        {
          $unset: {
            passwordResetTokenHash: "",
            passwordResetExpiresAt: "",
          },
        },
      );
    };

    try {
      const resetUrl = buildResetPasswordLink(rawToken);
      const trade = business.tradeName?.trim();
      const content = buildPasswordResetEmailContent({
        resetUrl,
        greetingName: trade || undefined,
      });
      await sendAuthTransactionalEmailWithRollback({
        to: normalizedEmail,
        content,
        correlationId,
        rollback: rollbackBusinessResetFields,
      });
      logVerificationIntentAudit({
        intent: PASSWORD_RESET_INTENT,
        phase: "delivered",
        correlationId,
        subjectKind: "business",
        subjectId: String(businessId),
      });
    } catch {
      logVerificationIntentAudit({
        intent: PASSWORD_RESET_INTENT,
        phase: "delivery_failed",
        correlationId,
        subjectKind: "business",
        subjectId: String(businessId),
      });
      await rollbackBusinessResetFields();
      return {
        kind: "server_error_500",
        message:
          "Unable to complete this request. Please try again later.",
      };
    }

    return { kind: "generic_200" };
  }

  const userId = user!._id as Types.ObjectId;
  const pd = user!.personalDetails as
    | { username?: string; firstName?: string }
    | undefined;
  const greetingName =
    pd?.username?.trim() || pd?.firstName?.trim() || undefined;

  const userCorrelationId = `pwd-reset-user:${String(userId)}`;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    },
  );

  logVerificationIntentAudit({
    intent: PASSWORD_RESET_INTENT,
    phase: "token_persisted",
    correlationId: userCorrelationId,
    subjectKind: "user",
    subjectId: String(userId),
  });

  const rollbackUserResetFields = async () => {
    await User.updateOne(
      { _id: userId },
      {
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpiresAt: "",
        },
      },
    );
  };

  try {
    const resetUrl = buildResetPasswordLink(rawToken);
    const content = buildPasswordResetEmailContent({
      resetUrl,
      greetingName,
    });
    await sendAuthTransactionalEmailWithRollback({
      to: normalizedEmail,
      content,
      correlationId: userCorrelationId,
      rollback: rollbackUserResetFields,
    });
    logVerificationIntentAudit({
      intent: PASSWORD_RESET_INTENT,
      phase: "delivered",
      correlationId: userCorrelationId,
      subjectKind: "user",
      subjectId: String(userId),
    });
  } catch {
    logVerificationIntentAudit({
      intent: PASSWORD_RESET_INTENT,
      phase: "delivery_failed",
      correlationId: userCorrelationId,
      subjectKind: "user",
      subjectId: String(userId),
    });
    await rollbackUserResetFields();
    return {
      kind: "server_error_500",
      message: "Unable to complete this request. Please try again later.",
    };
  }

  return { kind: "generic_200" };
}
