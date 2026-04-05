import Business from "../models/business.ts";
import User from "../models/user.ts";
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
  if (session.type === "business") {
    const b = await Business.findById(session.id)
      .select("email emailVerified")
      .lean();
    if (!b?.email) {
      return { kind: "account_not_found" };
    }
    if (b.emailVerified === true) {
      return {
        kind: "already_verified",
        message: RESEND_EMAIL_ALREADY_VERIFIED_MESSAGE,
      };
    }
    const normalized = normalizeRequestEmail(String(b.email));
    const r = await handleRequestEmailConfirmation(normalized);
    if (r.kind === "server_error_500") {
      return r;
    }
    return {
      kind: "success",
      message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    };
  }

  const u = await User.findById(session.id)
    .select("emailVerified personalDetails.email")
    .lean();
  if (!u) {
    return { kind: "account_not_found" };
  }
  const rawEmail = u.personalDetails?.email;
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return { kind: "account_not_found" };
  }
  if (u.emailVerified === true) {
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
