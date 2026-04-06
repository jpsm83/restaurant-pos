import bcrypt from "bcrypt";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "./confirmEmail.ts";

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
  | { kind: "success_200"; message: string }
  | { kind: "client_error"; message: string }
  | { kind: "server_error_500"; message: string };

export async function handleResetPassword(
  token: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const resetToken = token.trim();
  const plain = newPassword.trim();

  const now = new Date();
  const passwordHash = await bcrypt.hash(plain, 10);

  try {
    const business = await Business.findOneAndUpdate(
      {
        resetPasswordToken: resetToken,
        resetPasswordExpires: { $gt: now },
      },
      {
        $set: { password: passwordHash },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpires: "",
        },
        $inc: { refreshSessionVersion: 1 },
      },
      { returnDocument: "after" },
    ).lean();

    if (business) {
      return { kind: "success_200", message: RESET_PASSWORD_SUCCESS_MESSAGE };
    }

    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: resetToken,
        resetPasswordExpires: { $gt: now },
      },
      {
        $set: { "personalDetails.password": passwordHash },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpires: "",
        },
        $inc: { refreshSessionVersion: 1 },
      },
      { returnDocument: "after" },
    ).lean();

    if (user) {
      return { kind: "success_200", message: RESET_PASSWORD_SUCCESS_MESSAGE };
    }

    return {
      kind: "client_error",
      message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    };
  } catch {
    return {
      kind: "server_error_500",
      message: "Unable to complete this request. Please try again later.",
    };
  }
}
