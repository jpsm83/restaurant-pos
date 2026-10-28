import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import type { AuthSession } from "./types.ts";
import {
  GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  handleRequestEmailConfirmation,
  normalizeRequestEmail,
} from "./requestEmailConfirmation.ts";

export const RESEND_EMAIL_ALREADY_VERIFIED_MESSAGE =
  "Your email is already verified.";

export type ResendEmailConfirmationResult =
  | { kind: "success"; message: string }
  | { kind: "already_verified"; message: string }
  | { kind: "account_not_found" }
  | { kind: "server_error_500"; message: string };

/**
 * Uses **DB** sign-in email + verification state for the authenticated account (not body email).
 */
export async function handleResendEmailConfirmationForAuthenticatedAccount(
  session: AuthSession,
): Promise<ResendEmailConfirmationResult> {
  const account = await User.findOne(
    withSoftDeleteFilter({ _id: session.id }),
  )
    .select("personalDetails.email personalDetails.emailVerified")
    .lean();
  if (!account) {
    return { kind: "account_not_found" };
  }
  const rawEmail = account.personalDetails?.email;
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return { kind: "account_not_found" };
  }
  if (account.personalDetails?.emailVerified === true) {
    return {
      kind: "already_verified",
      message: RESEND_EMAIL_ALREADY_VERIFIED_MESSAGE,
    };
  }
  const normalized = normalizeRequestEmail(rawEmail);
  const r = await handleRequestEmailConfirmation(normalized);
  if (r.kind === "server_error_500") {
    return r;
  }
  return {
    kind: "success",
    message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  };
}
