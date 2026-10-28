import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import { sendAuthTokenEmailOrRollback } from "./authEmailTokenFlow.ts";
import { buildConfirmEmailLink } from "./emailLinks.ts";
import { buildEmailConfirmationContent } from "./emailTemplates.ts";

export const GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE =
  "If an account exists for this email, you will receive instructions shortly.";

export const EMAIL_CONFIRMATION_SENT_MESSAGE =
  "Email confirmation sent successfully. Please check your email.";

export const REACTIVATION_REQUIRED_MESSAGE =
  "Account reactivation required. Please confirm the email link we sent to reactivate this account.";

export function normalizeRequestEmail(email: string): string {
  return email.toLowerCase().trim();
}

export type RequestEmailConfirmationHandlerResult =
  | { kind: "success_200"; message: string }
  | { kind: "already_verified_400"; message: string }
  | {
      kind: "server_error_500";
      message: string;
    };

type ConfirmationUser = {
  _id: unknown;
  personalDetails?: { username?: string; firstName?: string } | null;
};

/** Writes the confirmation token on this User. */
export async function sendSoftDeletedUserConfirmation(
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
        { $set: { verificationToken: token } },
      ),
    buildLink: buildConfirmEmailLink,
    buildContent: (link) =>
      buildEmailConfirmationContent({ confirmUrl: link, greetingName }),
    rollback: () =>
      User.updateOne(
        withSoftDeleteFilter({ _id: user._id }, true),
        { $unset: { verificationToken: "" } },
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
    message: EMAIL_CONFIRMATION_SENT_MESSAGE,
  };
}

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

  if (!user) {
    return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
  }

  const userEmailVerified = user.personalDetails?.emailVerified === true;
  if (userEmailVerified && user.deleted !== true) {
    return { kind: "already_verified_400", message: "Email is already verified." };
  }

  return sendSoftDeletedUserConfirmation(user, normalizedEmail);
}
