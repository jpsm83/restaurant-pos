/**
 * Business contact-email verification.
 *
 * The venue contact address is not a credential: it never signs in and has no
 * session. An Admin/Owner requests one active 24-hour link, the account-email
 * rail sends it to the venue address, and the public confirm-email handler
 * consumes it to set `emailVerified` and clear the token state.
 */

import Business from "../models/business.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import {
  sendAuthTokenEmailOrRollback,
  VERIFICATION_TOKEN_TTL_MS,
} from "../auth/authEmailTokenFlow.ts";
import { buildConfirmEmailLink } from "../auth/emailLinks.ts";
import { buildBusinessContactVerificationContent } from "../auth/emailTemplates.ts";

/** Repeats inside this window are no-ops and change no token state. */
export const BUSINESS_CONTACT_VERIFICATION_COOLDOWN_MS = 60 * 1000;

export const BUSINESS_CONTACT_VERIFICATION_SENT_MESSAGE =
  "Verification email sent.";
export const BUSINESS_CONTACT_VERIFICATION_ALREADY_VERIFIED_MESSAGE =
  "This contact email is already verified.";
export const BUSINESS_CONTACT_VERIFICATION_COOLDOWN_MESSAGE =
  "A verification email was sent recently. Please try again in a minute.";
export const BUSINESS_CONTACT_VERIFICATION_NO_CONTACT_EMAIL_MESSAGE =
  "Add a contact email before requesting verification.";
export const BUSINESS_CONTACT_VERIFICATION_SEND_FAILED_MESSAGE =
  "Failed to send verification email. Please try again later.";

export type RequestBusinessContactVerificationResult =
  | { kind: "sent"; message: string }
  | { kind: "already_verified"; message: string }
  | { kind: "cooldown"; message: string }
  | { kind: "no_contact_email"; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "server_error_500"; message: string };

interface BusinessContactState {
  tradeName?: string;
  email?: string;
  emailVerified?: boolean;
  contactVerificationToken?: string;
  contactVerificationTokenExpires?: Date;
  contactVerificationRequestedAt?: Date;
}

const CONTACT_STATE_SELECT =
  "tradeName email emailVerified contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt";

/**
 * Issue (or intentionally skip) one contact-verification link. A new request
 * supersedes the previous token unless it is inside the cooldown. A failed send
 * restores the previous token state so an older working link survives.
 */
export async function requestBusinessContactEmailVerification(
  businessId: string,
): Promise<RequestBusinessContactVerificationResult> {
  const business = (await Business.findOne(
    withSoftDeleteFilter({ _id: businessId }),
  )
    .select(CONTACT_STATE_SELECT)
    .lean()) as BusinessContactState | null;

  if (!business) {
    return { kind: "not_found", message: "Business not found!" };
  }

  const email = business.email?.trim();
  if (!email) {
    return {
      kind: "no_contact_email",
      message: BUSINESS_CONTACT_VERIFICATION_NO_CONTACT_EMAIL_MESSAGE,
    };
  }

  if (business.emailVerified === true) {
    return {
      kind: "already_verified",
      message: BUSINESS_CONTACT_VERIFICATION_ALREADY_VERIFIED_MESSAGE,
    };
  }

  const now = new Date();
  const requestedAt = business.contactVerificationRequestedAt;
  if (
    requestedAt &&
    now.getTime() - requestedAt.getTime() <
      BUSINESS_CONTACT_VERIFICATION_COOLDOWN_MS
  ) {
    return {
      kind: "cooldown",
      message: BUSINESS_CONTACT_VERIFICATION_COOLDOWN_MESSAGE,
    };
  }

  const previousToken = business.contactVerificationToken;
  const previousExpiry = business.contactVerificationTokenExpires;
  const previousRequestedAt = business.contactVerificationRequestedAt;
  const venueName = business.tradeName?.trim() || "your venue";

  const sent = await sendAuthTokenEmailOrRollback({
    to: email,
    persist: (token) =>
      Business.updateOne(withSoftDeleteFilter({ _id: businessId }), {
        $set: {
          contactVerificationToken: token,
          contactVerificationTokenExpires: new Date(
            now.getTime() + VERIFICATION_TOKEN_TTL_MS,
          ),
          contactVerificationRequestedAt: now,
        },
      }),
    buildLink: buildConfirmEmailLink,
    buildContent: (link) =>
      buildBusinessContactVerificationContent({
        confirmUrl: link,
        venueName,
      }),
    rollback: () => {
      const set: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};

      if (previousToken !== undefined) {
        set.contactVerificationToken = previousToken;
      } else {
        unset.contactVerificationToken = "";
      }
      if (previousExpiry !== undefined) {
        set.contactVerificationTokenExpires = previousExpiry;
      } else {
        unset.contactVerificationTokenExpires = "";
      }
      if (previousRequestedAt !== undefined) {
        set.contactVerificationRequestedAt = previousRequestedAt;
      } else {
        unset.contactVerificationRequestedAt = "";
      }

      const update: Record<string, unknown> = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      return Business.updateOne(
        withSoftDeleteFilter({ _id: businessId }),
        update,
      );
    },
  });

  if (!sent) {
    return {
      kind: "server_error_500",
      message: BUSINESS_CONTACT_VERIFICATION_SEND_FAILED_MESSAGE,
    };
  }

  return {
    kind: "sent",
    message: BUSINESS_CONTACT_VERIFICATION_SENT_MESSAGE,
  };
}

/**
 * Consume one Business contact-verification token. Returns true only for an
 * active, unexpired link; a soft-deleted Business is never reactivated here.
 */
export async function confirmBusinessContactEmailToken(
  verificationToken: string,
): Promise<boolean> {
  const result = await Business.updateOne(
    withSoftDeleteFilter({
      contactVerificationToken: verificationToken,
      contactVerificationTokenExpires: { $gt: new Date() },
    }),
    {
      $set: { emailVerified: true },
      $unset: {
        contactVerificationToken: "",
        contactVerificationTokenExpires: "",
        contactVerificationRequestedAt: "",
      },
    },
  );

  return result.matchedCount > 0;
}
