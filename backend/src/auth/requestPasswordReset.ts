import crypto from "crypto";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { sendAuthTransactionalEmail } from "./authEmailSend.ts";
import { buildResetPasswordLink } from "./emailLinks.ts";
import { buildPasswordResetEmailContent } from "./emailTemplates.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "./requestEmailConfirmation.ts";

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
      ? await User.findOne({ "personalDetails.email": normalizedEmail })
          .select("_id personalDetails.username personalDetails.firstName")
          .lean()
      : null;

  if (!business && !user) {
    return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 3600000);

  if (business) {
    await Business.updateOne(
      { _id: business._id },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetTokenExpiry,
        },
      },
    );

    try {
      const resetUrl = buildResetPasswordLink(resetToken);
      const trade = business.tradeName?.trim();
      const content = buildPasswordResetEmailContent({
        resetUrl,
        greetingName: trade || undefined,
      });
      await sendAuthTransactionalEmail({
        to: normalizedEmail,
        content,
      });
    } catch {
      await Business.updateOne(
        { _id: business._id },
        {
          $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
        },
      );
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

  await User.updateOne(
    { _id: user!._id },
    {
      $set: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetTokenExpiry,
      },
    },
  );

  try {
    const resetUrl = buildResetPasswordLink(resetToken);
    const content = buildPasswordResetEmailContent({
      resetUrl,
      greetingName,
    });
    await sendAuthTransactionalEmail({
      to: normalizedEmail,
      content,
    });
  } catch {
    await User.updateOne(
      { _id: user!._id },
      {
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
      },
    );
    return {
      kind: "server_error_500",
      message: "Failed to send password reset email. Please try again later.",
    };
  }

  return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
}
