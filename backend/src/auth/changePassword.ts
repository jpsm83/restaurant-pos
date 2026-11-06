import bcrypt from "bcrypt";

import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import { matchesLinkedGoogleIdentity } from "./googleReauth.ts";
import { revokeOtherRefreshSessionsForUser } from "./issueSession.ts";
import type { GoogleVerifier } from "./google.ts";
import type { AuthUser } from "./types.ts";

export const CHANGE_PASSWORD_SUCCESS_MESSAGE =
  "Your password has been updated successfully.";

export type ChangePasswordInput = {
  newPassword: string;
  currentPassword?: string;
  googleCredential?: string;
};

export type ChangePasswordOptions = {
  googleVerifier?: GoogleVerifier | null;
};

export type ChangePasswordResult =
  | { kind: "success_200" }
  | { kind: "account_not_found" }
  | { kind: "invalid_password" }
  | { kind: "invalid_google_credential" };

/**
 * Sets or changes the signed-in User's password.
 *
 * The current password or a verified Google credential that resolves to the
 * identity already linked to this User proves re-authentication. A successful
 * change revokes every refresh session except the one that made the request,
 * so the person stays signed in here and on no other device.
 */
export async function handleChangePassword(
  session: AuthUser,
  sessionId: string,
  input: ChangePasswordInput,
  options: ChangePasswordOptions = {},
): Promise<ChangePasswordResult> {
  const { googleVerifier } = options;
  const { newPassword, currentPassword, googleCredential } = input;

  const user = await User.findOne(withSoftDeleteFilter({ _id: session.id }))
    .select("_id googleId personalDetails.password")
    .lean();

  if (!user) {
    return { kind: "account_not_found" };
  }

  let reauthenticated = false;

  if (googleCredential) {
    reauthenticated = await matchesLinkedGoogleIdentity(
      user.googleId,
      googleCredential,
      googleVerifier,
    );
    if (!reauthenticated) {
      return { kind: "invalid_google_credential" };
    }
  }

  if (
    typeof currentPassword === "string" &&
    currentPassword.length > 0 &&
    typeof user.personalDetails?.password === "string" &&
    user.personalDetails.password.length > 0
  ) {
    reauthenticated = await bcrypt.compare(
      currentPassword,
      user.personalDetails.password,
    );
  }

  if (!reauthenticated) {
    return { kind: "invalid_password" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne(
    withSoftDeleteFilter({ _id: user._id }),
    { $set: { "personalDetails.password": passwordHash } },
  );

  await revokeOtherRefreshSessionsForUser(String(user._id), sessionId);

  return { kind: "success_200" };
}
