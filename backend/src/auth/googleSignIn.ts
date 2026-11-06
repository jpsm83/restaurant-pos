/**
 * Google account resolution for the one sign-in/sign-up entry path.
 *
 * The verifier has already checked the token; this module decides which User
 * the verified identity belongs to, links a verified email, creates a new
 * verified User, or hands a soft-deleted account back to email reactivation.
 */
import type { Types } from "mongoose";
import type { GoogleAuthIntent } from "restaurant-pos-packages/schemas/auth";

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

/** The User fields the Google account-resolution lookups read. */
interface GoogleLinkedUserLookup {
  _id: Types.ObjectId;
  refreshSessionVersion?: number;
  languagePreference?: "en" | "es" | null;
  personalDetails?: {
    email?: string;
    username?: string;
    firstName?: string;
  } | null;
}

interface GoogleEmailUserLookup extends GoogleLinkedUserLookup {
  googleId?: string;
}

interface GoogleDeletedUserLookup {
  _id: Types.ObjectId;
  languagePreference?: string | null;
  personalDetails?: {
    username?: string;
    firstName?: string;
  } | null;
}

export type GoogleAuthInput = {
  credential: string;
  intent: GoogleAuthIntent;
  languagePreference?: "en" | "es";
};

export type GoogleAuthResult =
  | {
      kind: "session";
      userId: string;
      refreshSessionVersion: number;
      created: false;
      email: string;
      greetingName?: string;
      languagePreference?: "en" | "es" | null;
    }
  | {
      kind: "session";
      userId: string;
      refreshSessionVersion: number;
      created: true;
    }
  | { kind: "reactivation"; message: string }
  | { kind: "account_not_found" }
  | { kind: "google_email_conflict" }
  | { kind: "invalid_credential" }
  | { kind: "server_error_500"; message: string };

/**
 * The supported UI language a Google locale seeds, or `undefined` when the
 * locale is missing or not one of the supported languages.
 */
function languageFromGoogleLocale(
  locale: string | undefined,
): "en" | "es" | undefined {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return language === "en" || language === "es" ? language : undefined;
}

function greetingNameFor(
  user: GoogleLinkedUserLookup,
): string | undefined {
  return (
    user.personalDetails?.username?.trim() ||
    user.personalDetails?.firstName?.trim() ||
    undefined
  );
}

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

  const linkedUser = await User.findOne(
    withSoftDeleteFilter({ googleId: identity.subject }),
  )
    .select(
      "_id refreshSessionVersion languagePreference personalDetails.email personalDetails.username personalDetails.firstName",
    )
    .lean<GoogleLinkedUserLookup>();

  if (linkedUser) {
    return {
      kind: "session",
      userId: String(linkedUser._id),
      refreshSessionVersion: linkedUser.refreshSessionVersion ?? 0,
      created: false,
      email: linkedUser.personalDetails?.email ?? email,
      greetingName: greetingNameFor(linkedUser),
      languagePreference: linkedUser.languagePreference ?? null,
    };
  }

  const userByEmail = await User.findOne(
    withSoftDeleteFilter({ "personalDetails.email": email }),
  )
    .select(
      "_id googleId refreshSessionVersion languagePreference personalDetails.email personalDetails.username personalDetails.firstName",
    )
    .lean<GoogleEmailUserLookup>();

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
      email: userByEmail.personalDetails?.email ?? email,
      greetingName: greetingNameFor(userByEmail),
      languagePreference: userByEmail.languagePreference ?? null,
    };
  }

  const deletedUser = await User.findOne({
    "personalDetails.email": email,
    deleted: true,
  })
    .select(
      "_id languagePreference personalDetails.username personalDetails.firstName",
    )
    .lean<GoogleDeletedUserLookup>();

  if (deletedUser) {
    const sent = await sendUserVerificationEmail(deletedUser, email);
    if (sent.kind === "server_error_500") {
      return { kind: "server_error_500", message: sent.message };
    }
    return { kind: "reactivation", message: REACTIVATION_REQUIRED_MESSAGE };
  }

  // Sign-in never creates an account: an unknown Google identity is a
  // dedicated not-found outcome. The route schema has already rejected a
  // sign-up without the acceptance proof, so this is the create branch.
  if (input.intent === "signin") {
    return { kind: "account_not_found" };
  }

  const languagePreference =
    input.languagePreference ?? languageFromGoogleLocale(identity.locale);

  const createdUser = await User.create({
    ...(languagePreference ? { languagePreference } : {}),
    privacyAccepted: true,
    privacyAcceptedAt: new Date(),
    marketingConsent: false,
    googleId: identity.subject,
    personalDetails: {
      email,
      emailVerified: true,
      ...(identity.firstName ? { firstName: identity.firstName } : {}),
      ...(identity.lastName ? { lastName: identity.lastName } : {}),
      ...(identity.imageUrl ? { imageUrl: identity.imageUrl } : {}),
    },
  });

  return {
    kind: "session",
    userId: String(createdUser._id),
    refreshSessionVersion: createdUser.refreshSessionVersion ?? 0,
    created: true,
  };
}
