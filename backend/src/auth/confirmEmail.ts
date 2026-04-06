import Business from "../models/business.ts";
import User from "../models/user.ts";

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
  | { kind: "success_200"; message: string }
  | { kind: "client_error"; message: string }
  | { kind: "server_error_500"; message: string };

export async function handleConfirmEmail(
  token: string,
): Promise<ConfirmEmailResult> {
  const verificationToken = token.trim();

  try {
    const business = await Business.findOneAndUpdate(
      {
        verificationToken,
      },
      {
        $set: { emailVerified: true },
        $unset: { verificationToken: "" },
      },
      { returnDocument: "after" },
    ).lean();

    if (business) {
      return { kind: "success_200", message: CONFIRM_EMAIL_SUCCESS_MESSAGE };
    }

    const user = await User.findOneAndUpdate(
      {
        verificationToken,
      },
      {
        // Keep root mirror for backward compatibility while `personalDetails.emailVerified` is canonical.
        $set: { "personalDetails.emailVerified": true, emailVerified: true },
        $unset: { verificationToken: "" },
      },
      { returnDocument: "after" },
    ).lean();

    if (user) {
      return { kind: "success_200", message: CONFIRM_EMAIL_SUCCESS_MESSAGE };
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
