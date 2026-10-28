/**
 * Google account resolution for the one sign-in/sign-up entry path.
 *
 * The verifier has already checked the token; this module decides which User
 * the verified identity belongs to, links a verified email, creates a new
 * verified User, or hands a soft-deleted account back to email reactivation.
 */
import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import {
  normalizeRequestEmail,
  REACTIVATION_REQUIRED_MESSAGE,
  sendUserVerificationEmail,
} from "./requestEmailConfirmation.ts";
import {
  GoogleCredentialError,
  type GoogleIdentity,
  type GoogleVerifier,
} from "./google.ts";

export type GoogleAuthInput = {
  credential: string;
  languagePreference?: "en" | "es";
};

export type GoogleAuthResult =
  | {
      kind: "session";
      userId: string;
      refreshSessionVersion: number;
      created: boolean;
    }
  | { kind: "reactivation"; message: string }
  | { kind: "google_email_conflict" }
  | { kind: "invalid_credential" }
  | { kind: "server_error_500"; message: string };

export async function handleGoogleAuth(
  verifier: GoogleVerifier,
  input: GoogleAuthInput,
): Promise<GoogleAuthResult> {
  let identity: GoogleIdentity;
  try {
    identity = await verifier(input.credential);
  } catch (error) {
    if (error instanceof GoogleCredentialError) {
      return { kind: "invalid_credential" };
    }
    throw error;
  }

  const email = normalizeRequestEmail(identity.email);

  const linkedUser = (await User.findOne(
    withSoftDeleteFilter({ googleId: identity.subject }),
  )
    .select("_id refreshSessionVersion")
    .lean()) as {
    _id: unknown;
    refreshSessionVersion?: number;
  } | null;

  if (linkedUser) {
    return {
      kind: "session",
      userId: String(linkedUser._id),
      refreshSessionVersion: linkedUser.refreshSessionVersion ?? 0,
      created: false,
    };
  }

  const userByEmail = (await User.findOne(
    withSoftDeleteFilter({ "personalDetails.email": email }),
  )
    .select("_id googleId refreshSessionVersion")
    .lean()) as {
    _id: unknown;
    googleId?: string;
    refreshSessionVersion?: number;
  } | null;

  if (userByEmail) {
    if (userByEmail.googleId && userByEmail.googleId !== identity.subject) {
      return { kind: "google_email_conflict" };
    }

    await User.updateOne(withSoftDeleteFilter({ _id: userByEmail._id }), {
      $set: {
        googleId: identity.subject,
        "personalDetails.emailVerified": true,
      },
    });

    return {
      kind: "session",
      userId: String(userByEmail._id),
      refreshSessionVersion: userByEmail.refreshSessionVersion ?? 0,
      created: false,
    };
  }

  const deletedUser = (await User.findOne({
    "personalDetails.email": email,
    deleted: true,
  })
    .select("_id personalDetails.username personalDetails.firstName")
    .lean()) as {
    _id: unknown;
    personalDetails?: {
      username?: string;
      firstName?: string;
    } | null;
  } | null;

  if (deletedUser) {
    const sent = await sendUserVerificationEmail(deletedUser, email);
    if (sent.kind === "server_error_500") {
      return { kind: "server_error_500", message: sent.message };
    }
    return { kind: "reactivation", message: REACTIVATION_REQUIRED_MESSAGE };
  }

  const createdUser = await User.create({
    ...(input.languagePreference
      ? { languagePreference: input.languagePreference }
      : {}),
    googleId: identity.subject,
    personalDetails: {
      email,
      emailVerified: true,
      ...(identity.firstName ? { firstName: identity.firstName } : {}),
      ...(identity.lastName ? { lastName: identity.lastName } : {}),
    },
  });

  return {
    kind: "session",
    userId: String(createdUser._id),
    refreshSessionVersion: createdUser.refreshSessionVersion ?? 0,
    created: true,
  };
}
