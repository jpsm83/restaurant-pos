/**
 * Linked User identity for manager membership reads.
 *
 * The manager list and the management-contact picker expose a display name and
 * email without a second privileged read per person. Soft-deleted Users are
 * still resolved so retained memberships keep a human identity.
 */
import { Types } from "mongoose";

import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";

export type UserIdentity = {
  displayName: string;
  email: string;
};

/** Build the display name and email for one linked User. */
function userIdentity(
  user: { personalDetails?: Record<string, unknown> } | undefined,
): UserIdentity {
  const details = user?.personalDetails as
    | Record<string, string | undefined>
    | undefined;
  const first = details?.firstName?.trim() ?? "";
  const last = details?.lastName?.trim() ?? "";
  const name = `${first} ${last}`.trim();
  const email = details?.email?.trim() ?? "";
  return {
    displayName: name.length > 0 ? name : email || "—",
    email,
  };
}

/** Resolve linked User identities for a set of membership User ids. */
export async function loadUserIdentities(
  userIds: unknown[],
): Promise<Map<string, UserIdentity>> {
  const identities = new Map<string, UserIdentity>();
  if (userIds.length === 0) return identities;

  const users = await User.find(
    withSoftDeleteFilter(
      {
        _id: {
          $in: userIds.map((id) => new Types.ObjectId(String(id))),
        },
      },
      true,
    ),
  )
    .select(
      "personalDetails.firstName personalDetails.lastName personalDetails.email",
    )
    .lean();

  for (const user of users) {
    identities.set(String(user._id), userIdentity(user));
  }

  return identities;
}
