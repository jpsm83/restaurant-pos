import { compare } from "bcrypt";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { sendAuthTokenEmailOrRollback } from "./authEmailTokenFlow.ts";
import { buildConfirmEmailChangeLink } from "./emailLinks.ts";
import { buildEmailChangeConfirmationContent } from "./emailTemplates.ts";
import { normalizeRequestEmail } from "./requestEmailConfirmation.ts";
import type { AuthBusiness } from "./types.ts";
import type { RequestEmailChangeBody } from "restaurant-pos-packages/schemas/auth";

/** How long a pending sign-in email change link stays valid. */
export const EMAIL_CHANGE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const EMAIL_CHANGE_REQUESTED_MESSAGE =
  "Confirmation email sent. Check your new inbox to complete the change.";

export type RequestEmailChangeResult =
  | { kind: "success_200"; message: string }
  | { kind: "account_not_found" }
  | { kind: "invalid_password" }
  | { kind: "same_email" }
  | { kind: "email_taken" }
  | { kind: "server_error_500"; message: string };

/**
 * Starts a verified sign-in email change for the authenticated business.
 *
 * Re-authenticates with the current password, refuses an address already owned
 * or pending on another account, and stores the new address as pending — the
 * current sign-in email and its verified state are untouched until the new
 * address is confirmed through the emailed link. A new request replaces the
 * previous pending token (the old link dies).
 */
export async function handleRequestEmailChange(
  session: AuthBusiness,
  body: RequestEmailChangeBody,
): Promise<RequestEmailChangeResult> {
  const normalizedNewEmail = normalizeRequestEmail(body.newEmail);

  const business = await Business.findById(session.id)
    .select(
      "_id tradeName email password pendingEmail pendingEmailToken pendingEmailExpires",
    )
    .lean();

  if (!business) {
    return { kind: "account_not_found" };
  }

  const storedHash = business.password as string | undefined;
  const passwordOk =
    !!storedHash && (await compare(body.currentPassword, storedHash));
  if (!passwordOk) {
    return { kind: "invalid_password" };
  }

  const currentEmail = normalizeRequestEmail(String(business.email ?? ""));
  if (normalizedNewEmail === currentEmail) {
    return { kind: "same_email" };
  }

  const [otherBusiness, otherUser] = await Promise.all([
    Business.exists({
      _id: { $ne: business._id },
      $or: [
        { email: normalizedNewEmail },
        { pendingEmail: normalizedNewEmail },
      ],
    }),
    User.exists({ "personalDetails.email": normalizedNewEmail }),
  ]);
  if (otherBusiness || otherUser) {
    return { kind: "email_taken" };
  }

  // Snapshot any prior pending change so a failed send restores it instead of
  // silently killing a link the owner may still be using.
  const previousPending = {
    pendingEmail: business.pendingEmail,
    pendingEmailToken: business.pendingEmailToken,
    pendingEmailExpires: business.pendingEmailExpires,
  };

  const sent = await sendAuthTokenEmailOrRollback({
    to: normalizedNewEmail,
    persist: (token) =>
      Business.updateOne(
        { _id: business._id },
        {
          $set: {
            pendingEmail: normalizedNewEmail,
            pendingEmailToken: token,
            pendingEmailExpires: new Date(
              Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS,
            ),
          },
        },
      ),
    buildLink: buildConfirmEmailChangeLink,
    buildContent: (link) =>
      buildEmailChangeConfirmationContent({
        confirmUrl: link,
        greetingName: business.tradeName?.trim() || undefined,
      }),
    rollback: () =>
      Business.updateOne(
        { _id: business._id },
        buildPendingRollback(previousPending),
      ),
  });

  if (!sent) {
    return {
      kind: "server_error_500",
      message: "Failed to send confirmation email. Please try again later.",
    };
  }

  return { kind: "success_200", message: EMAIL_CHANGE_REQUESTED_MESSAGE };
}

/** Restores the pending fields captured before a request, clearing any unset at the time. */
function buildPendingRollback(previous: {
  pendingEmail?: unknown;
  pendingEmailToken?: unknown;
  pendingEmailExpires?: unknown;
}): Record<string, unknown> {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  for (const [field, value] of Object.entries(previous)) {
    if (value === undefined) {
      $unset[field] = 1;
    } else {
      $set[field] = value;
    }
  }

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;
  return update;
}
