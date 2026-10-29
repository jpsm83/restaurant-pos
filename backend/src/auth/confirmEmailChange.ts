import emailChannel from "../communications/channels/emailChannel.ts";
import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "./confirmEmail.ts";
import { buildEmailChangeNoticeContent } from "./emailTemplates.ts";
import { revokeAllRefreshSessionsForUser } from "./issueSession.ts";

export const CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE =
  "Your sign-in email has been updated. Please sign in again.";

export type ConfirmEmailChangeResult =
  | { kind: "success_200"; message: string }
  | { kind: "client_error"; message: string }
  | { kind: "email_taken" }
  | { kind: "server_error_500"; message: string };

/**
 * Consumes the pending sign-in email change token (one-time).
 *
 * Atomically swaps the sign-in email to the pending address, marks it verified,
 * clears every pending field, and bumps `refreshSessionVersion` so refresh
 * sessions from before the change stop working. A no-link security notice goes
 * to the *previous* address, best-effort: a failed notice never rolls back the
 * change.
 *
 * Invalid, expired, unknown, and already-used tokens all return the same
 * non-revealing message so account state is not leaked.
 */
export async function handleConfirmEmailChange(
  token: string,
): Promise<ConfirmEmailChangeResult> {
  // Stored tokens are lowercase hex; normalize so links still work if the
  // client uppercases the query param.
  const pendingEmailToken = token.trim().toLowerCase();
  const now = new Date();

  try {
    const pending = await User.findOne(
      withSoftDeleteFilter({
        pendingEmailToken,
        pendingEmailExpires: { $gt: now },
      }),
    )
      .select(
        "_id personalDetails.email personalDetails.username personalDetails.firstName pendingEmail",
      )
      .lean();

    if (!pending?.pendingEmail) {
      return {
        kind: "client_error",
        message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      };
    }

    const previousEmail = String(pending.personalDetails?.email ?? "").trim();
    const newEmail = String(pending.pendingEmail);
    const greetingName =
      pending.personalDetails?.username?.trim() ||
      pending.personalDetails?.firstName?.trim() ||
      undefined;

    let promoted: { matchedCount: number };
    try {
      promoted = await User.updateOne(
        withSoftDeleteFilter({
          _id: pending._id,
          pendingEmailToken,
          pendingEmailExpires: { $gt: now },
        }),
        {
          $set: {
            "personalDetails.email": newEmail,
            "personalDetails.emailVerified": true,
          },
          $unset: {
            pendingEmail: "",
            pendingEmailToken: "",
            pendingEmailExpires: "",
            pendingEmailRequestedAt: "",
          },
          $inc: { refreshSessionVersion: 1 },
        },
      );
    } catch (error) {
      // The new address became active for another account between request and
      // confirmation. Drop the dead pending link so the owner can request again
      // from the still-valid old address.
      if (isDuplicateKeyError(error)) {
        await clearPendingChange(pending._id, pendingEmailToken);
        return { kind: "email_taken" };
      }
      throw error;
    }

    if (promoted.matchedCount === 0) {
      return {
        kind: "client_error",
        message: CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      };
    }

    // The bumped generation already refuses older refresh sessions; revoking
    // them is cleanup. A failure there cannot undo the change.
    try {
      await revokeAllRefreshSessionsForUser(String(pending._id));
    } catch {
      // The account generation still invalidates the old sessions.
    }

    if (previousEmail) {
      try {
        await emailChannel.send({
          to: previousEmail,
          ...buildEmailChangeNoticeContent({
            newEmail,
            greetingName,
          }),
        });
      } catch {
        // Best-effort: the change already succeeded; a failed notice is not fatal.
      }
    }

    return {
      kind: "success_200",
      message: CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE,
    };
  } catch {
    return {
      kind: "server_error_500",
      message: "Unable to complete this request. Please try again later.",
    };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Best-effort removal of a pending link that can no longer be promoted. */
async function clearPendingChange(
  userId: unknown,
  pendingEmailToken: string,
): Promise<void> {
  try {
    await User.updateOne(
      withSoftDeleteFilter({ _id: userId, pendingEmailToken }),
      {
        $unset: {
          pendingEmail: "",
          pendingEmailToken: "",
          pendingEmailExpires: "",
          pendingEmailRequestedAt: "",
        },
      },
    );
  } catch {
    // The request path can replace the pending link on the next attempt anyway.
  }
}
