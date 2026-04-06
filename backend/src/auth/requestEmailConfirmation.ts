import crypto from "crypto";
import emailRegex from "../../../packages/utils/emailRegex.ts";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { sendAuthTransactionalEmail } from "./authEmailSend.ts";
import { buildConfirmEmailLink } from "./emailLinks.ts";
import { buildEmailConfirmationContent } from "./emailTemplates.ts";

export const GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE =
  "If an account exists for this email, you will receive instructions shortly.";

export const EMAIL_CONFIRMATION_SENT_MESSAGE =
  "Email confirmation sent successfully. Please check your email.";

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
  | { kind: "success_200"; message: string }
  | { kind: "already_verified_400"; message: string }
  | {
      kind: "server_error_500";
      message: string;
    };

export async function handleRequestEmailConfirmation(
  normalizedEmail: string,
): Promise<RequestEmailConfirmationHandlerResult> {
  const business = await Business.findOne({ email: normalizedEmail })
    .select("_id tradeName email emailVerified")
    .lean();

  const user =
    business == null
      ? await User.findOne({ "personalDetails.email": normalizedEmail })
          .select(
            "_id personalDetails.username personalDetails.firstName personalDetails.emailVerified emailVerified",
          )
          .lean()
      : null;

  if (!business && !user) {
    return { kind: "success_200", message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE };
  }

  if (business?.emailVerified === true) {
    // return { kind: "already_verified_400", message: "Email is already verified." };
  }
  const userEmailVerified =
    user?.personalDetails?.emailVerified === true || user?.emailVerified === true;
  if (userEmailVerified) {
    return { kind: "already_verified_400", message: "Email is already verified." };
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");

  if (business) {
    await Business.updateOne(
      { _id: business._id },
      {
        $set: {
          verificationToken,
        },
      },
    );

    try {
      const confirmUrl = buildConfirmEmailLink(verificationToken);
      const trade = business.tradeName?.trim();
      const content = buildEmailConfirmationContent({
        confirmUrl,
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
          $unset: { verificationToken: "" },
        },
      );
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

  const pd = user!.personalDetails as
    | { username?: string; firstName?: string }
    | undefined;
  const greetingName =
    pd?.username?.trim() || pd?.firstName?.trim() || undefined;

  await User.updateOne(
    { _id: user!._id },
    {
      $set: {
        verificationToken,
      },
    },
  );

  try {
    const confirmUrl = buildConfirmEmailLink(verificationToken);
    const content = buildEmailConfirmationContent({
      confirmUrl,
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
        $unset: { verificationToken: "" },
      },
    );
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
