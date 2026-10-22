import Business from "../models/business.ts";
import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import { sendAuthTokenEmailOrRollback } from "./authEmailTokenFlow.ts";
import { buildResetPasswordLink } from "./emailLinks.ts";
import { buildPasswordResetEmailContent } from "./emailTemplates.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "./requestEmailConfirmation.ts";

const RESET_TOKEN_TTL_MS = 3_600_000;

export type RequestPasswordResetHandlerResult =
  | { kind: "success_200"; message: string }
  | {
      kind: "server_error_500";
      message: string;
    };

export async function handleRequestPasswordReset(
  normalizedEmail: string,
): Promise<RequestPasswordResetHandlerResult> {
  const business = await Business.findOne({ email: normalizedEmail })
    .select("_id tradeName")
    .lean();

  const user =
    business == null
      ? await User.findOne(
          withSoftDeleteFilter({ "personalDetails.email": normalizedEmail }),
        )
          .select("_id personalDetails.username personalDetails.firstName")
          .lean()
      : null;

  if (!business && !user) {
    return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
  }

  if (business) {
    const sent = await sendAuthTokenEmailOrRollback({
      to: normalizedEmail,
      persist: (token) =>
        Business.updateOne(
          { _id: business._id },
          {
            $set: {
              resetPasswordToken: token,
              resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
            },
          },
        ),
      buildLink: buildResetPasswordLink,
      buildContent: (link) =>
        buildPasswordResetEmailContent({
          resetUrl: link,
          greetingName: business.tradeName?.trim() || undefined,
        }),
      rollback: () =>
        Business.updateOne(
          { _id: business._id },
          { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } },
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

  const pd = user!.personalDetails as
    | { username?: string; firstName?: string }
    | undefined;
  const greetingName =
    pd?.username?.trim() || pd?.firstName?.trim() || undefined;

  const sent = await sendAuthTokenEmailOrRollback({
    to: normalizedEmail,
    persist: (token) =>
      User.updateOne(
        { _id: user!._id },
        {
          $set: {
            resetPasswordToken: token,
            resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        },
      ),
    buildLink: buildResetPasswordLink,
    buildContent: (link) =>
      buildPasswordResetEmailContent({ resetUrl: link, greetingName }),
    rollback: () =>
      User.updateOne(
        { _id: user!._id },
        { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } },
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
