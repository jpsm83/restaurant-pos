import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import {
  sendAuthTokenEmailOrRollback,
  VERIFICATION_TOKEN_TTL_MS,
} from "./authEmailTokenFlow.ts";
import { buildConfirmEmailLink } from "./emailLinks.ts";
import { buildEmailConfirmationContent } from "./emailTemplates.ts";

export const GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE =
  "If an account exists for this email, you will receive instructions shortly.";

export const REACTIVATION_REQUIRED_MESSAGE =
  "Account reactivation required. Please confirm the email link we sent to reactivate this account.";

export function normalizeRequestEmail(email: string): string {
  return email.toLowerCase().trim();
}

export type RequestEmailConfirmationHandlerResult =
  | { kind: "success_200"; message: string }
  | {
      kind: "server_error_500";
      message: string;
    };

type ConfirmationUser = {
  _id: unknown;
  personalDetails?: { username?: string; firstName?: string } | null;
};

/**
 * Writes one active confirmation link (token + 24-hour expiry) on this User.
 * A new request replaces the previous link for the same purpose.
 */
export async function sendUserVerificationEmail(
  user: ConfirmationUser,
  normalizedEmail: string,
): Promise<RequestEmailConfirmationHandlerResult> {
  const pd = user.personalDetails ?? undefined;
  const greetingName =
    pd?.username?.trim() || pd?.firstName?.trim() || undefined;

  const sent = await sendAuthTokenEmailOrRollback({
    to: normalizedEmail,
    persist: (token) =>
      User.updateOne(
        withSoftDeleteFilter({ _id: user._id }, true),
        {
          $set: {
            verificationToken: token,
            verificationTokenExpires: new Date(
              Date.now() + VERIFICATION_TOKEN_TTL_MS,
            ),
          },
        },
      ),
    buildLink: buildConfirmEmailLink,
    buildContent: (link) =>
      buildEmailConfirmationContent({ confirmUrl: link, greetingName }),
    rollback: () =>
      User.updateOne(
        withSoftDeleteFilter({ _id: user._id }, true),
        {
          $unset: {
            verificationToken: "",
            verificationTokenExpires: "",
          },
        },
      ),
  });

  if (!sent) {
    return {
      kind: "server_error_500",
      message: "Failed to send confirmation email. Please try again later.",
    };
  }

  return {
    kind: "success_200",
    message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  };
}

/**
 * Anti-enumeration verification request. Known and unknown addresses get the
 * same outcome; an already-verified account is also silent. Only a User who
 * needs a link is written to and mailed.
 */
export async function handleRequestEmailConfirmation(
  normalizedEmail: string,
): Promise<RequestEmailConfirmationHandlerResult> {
  const user = await User.findOne(
    withSoftDeleteFilter(
      { "personalDetails.email": normalizedEmail },
      true,
    ),
  )
    .select(
      "_id personalDetails.username personalDetails.firstName personalDetails.emailVerified deleted",
    )
    .lean();

  const alreadyVerifiedActive =
    user?.personalDetails?.emailVerified === true && user.deleted !== true;
  if (!user || alreadyVerifiedActive) {
    return {
      kind: "success_200",
      message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    };
  }

  return sendUserVerificationEmail(user, normalizedEmail);
}
