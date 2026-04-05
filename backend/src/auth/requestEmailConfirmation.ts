import type { Types } from "mongoose";
import emailRegex from "../../../packages/utils/emailRegex.ts";
import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { sendAuthTransactionalEmailWithRollback } from "./authEmailSend.ts";
import { tryConsumeVerificationIntentEmailSlot } from "./authEmailRateLimit.ts";
import { buildConfirmEmailLink } from "./emailLinks.ts";
import { buildEmailConfirmationContent } from "./emailTemplates.ts";
import { logVerificationIntentAudit } from "./verificationIntentAudit.ts";
import { createIntentTokenForVerificationIntent } from "./verificationIntentToken.ts";

export const GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE =
  "If an account exists for this email, you will receive instructions shortly.";

export function isValidRequestEmailConfirmationInput(
  email: unknown,
): email is string {
  if (typeof email !== "string") return false;
  const normalized = email.toLowerCase().trim();
  return normalized.length > 0 && emailRegex.test(normalized);
}

export function normalizeRequestEmail(email: string): string {
  return email.toLowerCase().trim();
}

export type RequestEmailConfirmationHandlerResult =
  | { kind: "generic_200" }
  | {
      kind: "server_error_500";
      message: string;
    };

const EMAIL_CONFIRM_INTENT = VerificationIntent.EmailConfirmation;

/**
 * Looks up **business first**, then **user** (same priority as login). Issues confirmation token + sends email when needed.
 */
export async function handleRequestEmailConfirmation(
  normalizedEmail: string,
): Promise<RequestEmailConfirmationHandlerResult> {
  const business = await Business.findOne({ email: normalizedEmail })
    .select(
      "_id tradeName email emailVerified emailVerificationTokenHash emailVerificationExpiresAt",
    )
    .lean();

  const user =
    business == null
      ? await User.findOne({ "personalDetails.email": normalizedEmail })
          .select(
            "_id personalDetails.username personalDetails.firstName personalDetails.email emailVerified emailVerificationTokenHash emailVerificationExpiresAt",
          )
          .lean()
      : null;

  if (!business && !user) {
    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "issue_skipped",
      skipReason: "no_account",
    });
    return { kind: "generic_200" };
  }

  if (business?.emailVerified === true) {
    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "issue_skipped",
      skipReason: "already_verified",
      subjectKind: "business",
      subjectId: String(business._id),
    });
    return { kind: "generic_200" };
  }
  if (user?.emailVerified === true) {
    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "issue_skipped",
      skipReason: "already_verified",
      subjectKind: "user",
      subjectId: String(user._id),
    });
    return { kind: "generic_200" };
  }

  if (!tryConsumeVerificationIntentEmailSlot(EMAIL_CONFIRM_INTENT, normalizedEmail)) {
    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "issue_skipped",
      skipReason: "rate_limited",
    });
    return { kind: "generic_200" };
  }

  const { rawToken, tokenHash, expiresAt } =
    createIntentTokenForVerificationIntent(EMAIL_CONFIRM_INTENT);

  if (business) {
    const businessId = business._id as Types.ObjectId;
    const correlationId = `email-confirm-business:${String(businessId)}`;
    await Business.updateOne(
      { _id: businessId },
      {
        $set: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: expiresAt,
        },
      },
    );

    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "token_persisted",
      correlationId,
      subjectKind: "business",
      subjectId: String(businessId),
    });

    const rollbackBusinessVerificationFields = async () => {
      await Business.updateOne(
        { _id: businessId },
        {
          $unset: {
            emailVerificationTokenHash: "",
            emailVerificationExpiresAt: "",
          },
        },
      );
    };

    try {
      const confirmUrl = buildConfirmEmailLink(rawToken);
      const trade = business.tradeName?.trim();
      const content = buildEmailConfirmationContent({
        confirmUrl,
        greetingName: trade || undefined,
      });
      await sendAuthTransactionalEmailWithRollback({
        to: normalizedEmail,
        content,
        correlationId,
        rollback: rollbackBusinessVerificationFields,
      });
      logVerificationIntentAudit({
        intent: EMAIL_CONFIRM_INTENT,
        phase: "delivered",
        correlationId,
        subjectKind: "business",
        subjectId: String(businessId),
      });
    } catch {
      logVerificationIntentAudit({
        intent: EMAIL_CONFIRM_INTENT,
        phase: "delivery_failed",
        correlationId,
        subjectKind: "business",
        subjectId: String(businessId),
      });
      await rollbackBusinessVerificationFields();
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

  const userCorrelationId = `email-confirm-user:${String(userId)}`;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    },
  );

  logVerificationIntentAudit({
    intent: EMAIL_CONFIRM_INTENT,
    phase: "token_persisted",
    correlationId: userCorrelationId,
    subjectKind: "user",
    subjectId: String(userId),
  });

  const rollbackUserVerificationFields = async () => {
    await User.updateOne(
      { _id: userId },
      {
        $unset: {
          emailVerificationTokenHash: "",
          emailVerificationExpiresAt: "",
        },
      },
    );
  };

  try {
    const confirmUrl = buildConfirmEmailLink(rawToken);
    const content = buildEmailConfirmationContent({
      confirmUrl,
      greetingName,
    });
    await sendAuthTransactionalEmailWithRollback({
      to: normalizedEmail,
      content,
      correlationId: userCorrelationId,
      rollback: rollbackUserVerificationFields,
    });
    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "delivered",
      correlationId: userCorrelationId,
      subjectKind: "user",
      subjectId: String(userId),
    });
  } catch {
    logVerificationIntentAudit({
      intent: EMAIL_CONFIRM_INTENT,
      phase: "delivery_failed",
      correlationId: userCorrelationId,
      subjectKind: "user",
      subjectId: String(userId),
    });
    await rollbackUserVerificationFields();
    return {
      kind: "server_error_500",
      message: "Unable to complete this request. Please try again later.",
    };
  }

  return { kind: "generic_200" };
}
