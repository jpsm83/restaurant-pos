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

/** Where a stored profile photo came from; `removed` is a user choice. */
type ProfileImageSource = "google" | "upload" | "removed";

/** Mapped Google profile details a User or a Google identity may carry. */
interface GoogleProfileFields {
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

/** The User fields the Google account-resolution lookups read. */
interface GoogleProfileLookup {
  languagePreference?: "en" | "es" | null;
  personalDetails?:
    | (GoogleProfileFields & {
        email?: string;
        username?: string;
        imageSource?: ProfileImageSource;
      })
    | null;
}

interface GoogleLinkedUserLookup extends GoogleProfileLookup {
  _id: Types.ObjectId;
  refreshSessionVersion?: number;
}

/** Mapped profile values a Google identity can fill in when the User has none. */
interface GoogleProfileBackfill extends GoogleProfileFields {
  languagePreference?: "en" | "es";
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

const GOOGLE_USER_LOOKUP_SELECT =
  "_id googleId refreshSessionVersion languagePreference personalDetails.email personalDetails.username personalDetails.firstName personalDetails.lastName personalDetails.imageUrl personalDetails.imageSource";

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
  backfilledFirstName?: string,
): string | undefined {
  return (
    user.personalDetails?.username?.trim() ||
    backfilledFirstName ||
    user.personalDetails?.firstName?.trim() ||
    undefined
  );
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
}

/**
 * The mapped Google profile values that are missing on the User. Populated
 * values are never returned, so a fully populated profile yields no fields.
 */
function profileBackfillFor(
  identity: GoogleIdentity,
  user: GoogleProfileLookup,
): GoogleProfileBackfill {
  const backfill: GoogleProfileBackfill = {};

  if (isBlank(user.personalDetails?.firstName) && identity.firstName) {
    backfill.firstName = identity.firstName;
  }
  if (isBlank(user.personalDetails?.lastName) && identity.lastName) {
    backfill.lastName = identity.lastName;
  }
  // A provider picture seeds only an untouched avatar. An upload or an
  // explicit removal is the person's choice and must survive future sign-ins.
  const imageIsUserOwned =
    user.personalDetails?.imageSource === "upload" ||
    user.personalDetails?.imageSource === "removed";
  if (
    isBlank(user.personalDetails?.imageUrl) &&
    identity.imageUrl &&
    !imageIsUserOwned
  ) {
    backfill.imageUrl = identity.imageUrl;
  }

  const language = languageFromGoogleLocale(identity.locale);
  if (isBlank(user.languagePreference) && language) {
    backfill.languagePreference = language;
  }

  return backfill;
}

/** The `$set` paths for a backfill, empty when there is nothing to fill. */
function profileBackfillUpdate(
  backfill: GoogleProfileBackfill,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (backfill.firstName) {
    update["personalDetails.firstName"] = backfill.firstName;
  }
  if (backfill.lastName) {
    update["personalDetails.lastName"] = backfill.lastName;
  }
  if (backfill.imageUrl) {
    update["personalDetails.imageUrl"] = backfill.imageUrl;
    update["personalDetails.imageSource"] = "google";
    update["personalDetails.imageUpdatedAt"] = new Date();
  }
  if (backfill.languagePreference) {
    update.languagePreference = backfill.languagePreference;
  }

  return update;
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
    .select(GOOGLE_USER_LOOKUP_SELECT)
    .lean<GoogleLinkedUserLookup>();

  if (linkedUser) {
    const backfill = profileBackfillFor(identity, linkedUser);
    const backfillUpdate = profileBackfillUpdate(backfill);
    if (Object.keys(backfillUpdate).length > 0) {
      await User.updateOne(withSoftDeleteFilter({ _id: linkedUser._id }), {
        $set: backfillUpdate,
      });
    }

    return {
      kind: "session",
      userId: String(linkedUser._id),
      refreshSessionVersion: linkedUser.refreshSessionVersion ?? 0,
      created: false,
      email: linkedUser.personalDetails?.email ?? email,
      greetingName: greetingNameFor(linkedUser, backfill.firstName),
      languagePreference:
        backfill.languagePreference ?? linkedUser.languagePreference ?? null,
    };
  }

  const userByEmail = await User.findOne(
    withSoftDeleteFilter({ "personalDetails.email": email }),
  )
    .select(GOOGLE_USER_LOOKUP_SELECT)
    .lean<GoogleEmailUserLookup>();

  if (userByEmail) {
    if (userByEmail.googleId && userByEmail.googleId !== identity.subject) {
      return { kind: "google_email_conflict" };
    }

    const backfill = profileBackfillFor(identity, userByEmail);
    await User.updateOne(withSoftDeleteFilter({ _id: userByEmail._id }), {
      $set: {
        googleId: identity.subject,
        "personalDetails.emailVerified": true,
        ...profileBackfillUpdate(backfill),
      },
    });

    return {
      kind: "session",
      userId: String(userByEmail._id),
      refreshSessionVersion: userByEmail.refreshSessionVersion ?? 0,
      created: false,
      email: userByEmail.personalDetails?.email ?? email,
      greetingName: greetingNameFor(userByEmail, backfill.firstName),
      languagePreference:
        backfill.languagePreference ?? userByEmail.languagePreference ?? null,
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
      ...(identity.imageUrl
        ? {
            imageUrl: identity.imageUrl,
            imageSource: "google" as const,
            imageUpdatedAt: new Date(),
          }
        : {}),
    },
  });

  return {
    kind: "session",
    userId: String(createdUser._id),
    refreshSessionVersion: createdUser.refreshSessionVersion ?? 0,
    created: true,
  };
}
