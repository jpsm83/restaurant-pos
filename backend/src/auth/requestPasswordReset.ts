import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  sendAuthTokenEmailOrRollback,
} from "./authEmailTokenFlow.ts";
import { buildResetPasswordLink } from "./emailLinks.ts";
import { buildPasswordResetEmailContent } from "./emailTemplates.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "./requestEmailConfirmation.ts";
import { isRequestWithinCooldown } from "./requestCooldown.ts";

export type RequestPasswordResetHandlerResult =
  | { kind: "success_200"; message: string }
  | {
      kind: "server_error_500";
      message: string;
    };

export async function handleRequestPasswordReset(
  normalizedEmail: string,
): Promise<RequestPasswordResetHandlerResult> {
  const user = await User.findOne(
    withSoftDeleteFilter({ "personalDetails.email": normalizedEmail }),
  )
    .select(
      "_id languagePreference personalDetails.username personalDetails.firstName resetPasswordRequestedAt",
    )
    .lean();

  if (!user) {
    return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
  }

  // A recent link was already sent: answer generically, send nothing, and leave
  // the still-valid link untouched.
  if (isRequestWithinCooldown(user.resetPasswordRequestedAt)) {
    return {
      kind: "success_200",
      message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    };
  }

  const pd = user.personalDetails as
    | { username?: string; firstName?: string }
    | undefined;
  const greetingName =
    pd?.username?.trim() || pd?.firstName?.trim() || undefined;
  const now = new Date();

  const sent = await sendAuthTokenEmailOrRollback({
    to: normalizedEmail,
    persist: (token) =>
      User.updateOne(
        { _id: user._id },
        {
          $set: {
            resetPasswordToken: token,
            resetPasswordExpires: new Date(
              now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS,
            ),
            resetPasswordRequestedAt: now,
          },
        },
      ),
    buildLink: buildResetPasswordLink,
    buildContent: (link) =>
      buildPasswordResetEmailContent({
        resetUrl: link,
        greetingName,
        language: user.languagePreference,
      }),
    rollback: () =>
      User.updateOne(
        { _id: user._id },
        {
          $unset: {
            resetPasswordToken: "",
            resetPasswordExpires: "",
            resetPasswordRequestedAt: "",
          },
        },
      ),
  });

  if (!sent) {
    return {
      kind: "server_error_500",
      message: "Failed to send password reset email. Please try again later.",
    };
  }

  return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
}
