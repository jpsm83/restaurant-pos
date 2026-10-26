import { compare } from "bcrypt";
import type { FastifyBaseLogger } from "fastify";
import Business from "../models/business.ts";
import User from "../models/user.ts";
import { sendAuthTokenEmailOrRollback } from "./authEmailTokenFlow.ts";
import { buildConfirmEmailChangeLink } from "./emailLinks.ts";
import { buildEmailChangeConfirmationContent } from "./emailTemplates.ts";
import {
  EMAIL_CHANGE_REQUEST_EVENT,
  logEmailChange,
  recordEmailChangeAudit,
  type EmailChangeAuditOutcome,
} from "./emailChangeAuditLog.ts";
import { AUDIT_ACT_KINDS } from "../audit/auditCatalogue.ts";
import { normalizeRequestEmail } from "./requestEmailConfirmation.ts";
import type { AuthBusiness } from "./types.ts";
import type { RequestEmailChangeBody } from "restaurant-pos-packages/schemas/auth";

/** How long a pending sign-in email change link stays valid. */
export const EMAIL_CHANGE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum gap between change links for one account; blunts email-spam abuse. */
export const EMAIL_CHANGE_REQUEST_COOLDOWN_MS = 60 * 1000;

export const EMAIL_CHANGE_REQUESTED_MESSAGE =
  "Confirmation email sent. Check your new inbox to complete the change.";

export type RequestEmailChangeResult =
  | { kind: "success_200"; message: string }
  | { kind: "account_not_found" }
  | { kind: "invalid_password" }
  | { kind: "same_email" }
  | { kind: "email_taken" }
  | { kind: "throttled"; message: string }
  | { kind: "server_error_500"; message: string };

/**
 * Starts a verified sign-in email change for the authenticated business.
 *
 * Re-authenticates with the current password, refuses an address already owned
 * or pending on another account, and stores the new address as pending — the
 * current sign-in email and its verified state are untouched until the new
 * address is confirmed through the emailed link. A new request replaces the
 * previous pending token (the old link dies), but only once the per-account
 * cooldown has elapsed.
 */
export async function handleRequestEmailChange(
  session: AuthBusiness,
  body: RequestEmailChangeBody,
  logger?: FastifyBaseLogger,
): Promise<RequestEmailChangeResult> {
  const accountId = session.id;
  const normalizedNewEmail = normalizeRequestEmail(body.newEmail);
  const audit = (outcome: EmailChangeAuditOutcome) =>
    logEmailChange(logger, {
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId,
      outcome,
    });

  const business = await Business.findById(session.id)
    .select(
      "_id tradeName email password pendingEmail pendingEmailToken pendingEmailExpires pendingEmailRequestedAt",
    )
    .lean();

  if (!business) {
    audit("account_not_found");
    return { kind: "account_not_found" };
  }

  const storedHash = business.password as string | undefined;
  const passwordOk =
    !!storedHash && (await compare(body.currentPassword, storedHash));
  if (!passwordOk) {
    audit("invalid_password");
    return { kind: "invalid_password" };
  }

  const currentEmail = normalizeRequestEmail(String(business.email ?? ""));
  if (normalizedNewEmail === currentEmail) {
    audit("same_email");
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
    audit("email_taken");
    return { kind: "email_taken" };
  }

  // A recent link was already sent: answer generically, send nothing, and leave
  // the still-valid pending link untouched.
  if (isWithinRequestCooldown(business.pendingEmailRequestedAt)) {
    audit("throttled");
    return { kind: "throttled", message: EMAIL_CHANGE_REQUESTED_MESSAGE };
  }

  // Snapshot any prior pending change so a failed send restores it instead of
  // silently killing a link the owner may still be using.
  const previousPending = {
    pendingEmail: business.pendingEmail,
    pendingEmailToken: business.pendingEmailToken,
    pendingEmailExpires: business.pendingEmailExpires,
    pendingEmailRequestedAt: business.pendingEmailRequestedAt,
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
            pendingEmailRequestedAt: new Date(),
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
    audit("send_failed");
    return {
      kind: "server_error_500",
      message: "Failed to send confirmation email. Please try again later.",
    };
  }

  await recordEmailChangeAudit({
    logger,
    event: EMAIL_CHANGE_REQUEST_EVENT,
    accountId,
    actKind: AUDIT_ACT_KINDS.EMAIL_CHANGE_REQUESTED,
    outcome: "sent",
  });

  return { kind: "success_200", message: EMAIL_CHANGE_REQUESTED_MESSAGE };
}

function isWithinRequestCooldown(requestedAt: unknown): boolean {
  if (!(requestedAt instanceof Date)) return false;
  return Date.now() - requestedAt.getTime() < EMAIL_CHANGE_REQUEST_COOLDOWN_MS;
}

/** Restores the pending fields captured before a request, clearing any unset at the time. */
function buildPendingRollback(previous: {
  pendingEmail?: unknown;
  pendingEmailToken?: unknown;
  pendingEmailExpires?: unknown;
  pendingEmailRequestedAt?: unknown;
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
