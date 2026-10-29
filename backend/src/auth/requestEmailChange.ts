import type { FastifyBaseLogger } from "fastify";
import bcrypt from "bcrypt";

import { AUDIT_ACT_KINDS } from "../audit/auditCatalogue.ts";
import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import {
  sendAuthTokenEmailOrRollback,
} from "./authEmailTokenFlow.ts";
import { buildConfirmEmailChangeLink } from "./emailLinks.ts";
import { buildEmailChangeConfirmationContent } from "./emailTemplates.ts";
import {
  EMAIL_CHANGE_REQUEST_EVENT,
  logEmailChange,
  recordEmailChangeAudit,
  type EmailChangeAuditOutcome,
} from "./emailChangeAuditLog.ts";
import { normalizeRequestEmail } from "./requestEmailConfirmation.ts";
import type { AuthUser } from "./types.ts";

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

type PendingChange = {
  pendingEmail?: string;
  pendingEmailToken?: string;
  pendingEmailExpires?: Date;
  pendingEmailRequestedAt?: Date;
};

/**
 * Starts a verified sign-in email change for the signed-in User.
 *
 * Re-authenticates with the current password, refuses an address already active
 * or reserved by an in-flight change on another User, and stores the new
 * address as pending — the current sign-in email and its verified flag stay
 * untouched until the new address is confirmed through the emailed link. A new
 * request replaces the previous pending token only once the cooldown elapses.
 */
export async function handleRequestEmailChange(
  session: AuthUser,
  newEmail: string,
  currentPassword: string,
  logger?: FastifyBaseLogger,
): Promise<RequestEmailChangeResult> {
  const accountId = session.id;
  const normalizedNewEmail = normalizeRequestEmail(newEmail);
  const audit = (outcome: EmailChangeAuditOutcome) =>
    logEmailChange(logger, {
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId,
      outcome,
    });
  const fail = (outcome: EmailChangeAuditOutcome) => {
    audit(outcome);
    return outcome;
  };

  const user = await User.findOne(withSoftDeleteFilter({ _id: session.id }))
    .select(
      "_id personalDetails.email personalDetails.password personalDetails.emailVerified personalDetails.username personalDetails.firstName pendingEmail pendingEmailToken pendingEmailExpires pendingEmailRequestedAt",
    )
    .lean();

  if (!user) {
    fail("account_not_found");
    return { kind: "account_not_found" };
  }

  const storedHash = user.personalDetails?.password;
  const passwordOk =
    typeof storedHash === "string" &&
    storedHash.length > 0 &&
    (await bcrypt.compare(currentPassword, storedHash));
  if (!passwordOk) {
    fail("invalid_password");
    return { kind: "invalid_password" };
  }

  const currentEmail = normalizeRequestEmail(
    String(user.personalDetails?.email ?? ""),
  );
  if (normalizedNewEmail === currentEmail) {
    fail("same_email");
    return { kind: "same_email" };
  }

  const conflicted = await User.exists(
    withSoftDeleteFilter({
      _id: { $ne: user._id },
      $or: [
        { "personalDetails.email": normalizedNewEmail },
        {
          pendingEmail: normalizedNewEmail,
          pendingEmailExpires: { $gt: new Date() },
        },
      ],
    }),
  );
  if (conflicted) {
    fail("email_taken");
    return { kind: "email_taken" };
  }

  // A recent link was already sent: answer generically, send nothing, and leave
  // the still-valid pending link untouched.
  if (isWithinRequestCooldown(user.pendingEmailRequestedAt)) {
    fail("throttled");
    return { kind: "throttled", message: EMAIL_CHANGE_REQUESTED_MESSAGE };
  }

  // Snapshot any prior pending change so a failed send restores it instead of
  // silently killing a link the owner may still be using.
  const previousPending: PendingChange = {
    pendingEmail: user.pendingEmail,
    pendingEmailToken: user.pendingEmailToken,
    pendingEmailExpires: user.pendingEmailExpires,
    pendingEmailRequestedAt: user.pendingEmailRequestedAt,
  };

  const greetingName =
    user.personalDetails?.username?.trim() ||
    user.personalDetails?.firstName?.trim() ||
    undefined;

  const sent = await sendAuthTokenEmailOrRollback({
    to: normalizedNewEmail,
    persist: (token) =>
      User.updateOne(
        withSoftDeleteFilter({ _id: user._id }, true),
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
        greetingName,
      }),
    rollback: () =>
      User.updateOne(
        withSoftDeleteFilter({ _id: user._id }, true),
        buildPendingRollback(previousPending),
      ),
  });

  if (!sent) {
    fail("send_failed");
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

/** Restores the pending fields captured before a request, clearing those unset then. */
function buildPendingRollback(previous: PendingChange): {
  $set?: Record<string, unknown>;
  $unset?: Record<string, "">;
} {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  for (const [field, value] of Object.entries(previous)) {
    if (value === undefined) {
      $unset[field] = "";
    } else {
      $set[field] = value;
    }
  }

  const update: {
    $set?: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;
  return update;
}
