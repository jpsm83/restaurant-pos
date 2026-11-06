/**
 * Self-profile read model.
 *
 * The authenticated profile read returns an explicit client whitelist plus a
 * derived `accountStatus` object. The pending address, token values and
 * expiries, Google subject, password hash, and session counters are read to
 * derive facts but never echoed to the client.
 */

/** Fields the self-profile read needs; all values are projected out of the response. */
export const SELF_PROFILE_READ_SELECTION = {
  personalDetails: 1,
  languagePreference: 1,
  themePreference: 1,
  createdAt: 1,
  updatedAt: 1,
  googleId: 1,
  privacyAcceptedAt: 1,
  pendingEmail: 1,
  pendingEmailExpires: 1,
  pendingEmailRequestedAt: 1,
  verificationRequestedAt: 1,
} as const;

export type SelfProfileSource = {
  _id: unknown;
  personalDetails?: {
    email?: string;
    emailVerified?: boolean;
    username?: string;
    password?: string;
    address?: unknown;
    firstName?: string;
    lastName?: string;
    nationality?: string;
    gender?: string;
    birthDate?: Date;
    phoneNumber?: string;
    imageUrl?: string;
  };
  languagePreference?: "en" | "es";
  themePreference?: "light" | "dark" | "system";
  createdAt?: Date;
  updatedAt?: Date;
  googleId?: string;
  privacyAcceptedAt?: Date;
  pendingEmail?: string;
  pendingEmailExpires?: Date;
  pendingEmailRequestedAt?: Date;
  verificationRequestedAt?: Date;
};

type SelfProfilePersonalDetails = NonNullable<
  SelfProfileSource["personalDetails"]
>;

/** A pending change counts only while its confirmation link is still usable. */
function hasActivePendingEmailChange(user: SelfProfileSource): boolean {
  return (
    typeof user.pendingEmail === "string" &&
    user.pendingEmail.length > 0 &&
    user.pendingEmailExpires instanceof Date &&
    user.pendingEmailExpires.getTime() > Date.now()
  );
}

/** Account facts the Security page may show; no address, subject, or token. */
function buildAccountStatus(
  user: SelfProfileSource,
  personal: SelfProfilePersonalDetails,
) {
  const hasPendingEmailChange = hasActivePendingEmailChange(user);
  return {
    createdAt: user.createdAt ?? null,
    emailVerified: personal.emailVerified === true,
    privacyAcceptedAt: user.privacyAcceptedAt ?? null,
    hasPendingEmailChange,
    pendingEmailRequestedAt: hasPendingEmailChange
      ? (user.pendingEmailRequestedAt ?? null)
      : null,
    verificationRequestedAt: user.verificationRequestedAt ?? null,
    hasPassword:
      typeof personal.password === "string" && personal.password.length > 0,
    hasGoogleIdentity:
      typeof user.googleId === "string" && user.googleId.length > 0,
  };
}

/**
 * Build the client-profile response from a whitelist. A newly added
 * server-owned field cannot leak through the read.
 */
export function toSelfProfileResponse(user: SelfProfileSource) {
  const personal = user.personalDetails ?? {};
  return {
    _id: user._id,
    personalDetails: {
      email: personal.email,
      username: personal.username,
      address: personal.address,
      firstName: personal.firstName,
      lastName: personal.lastName,
      nationality: personal.nationality,
      gender: personal.gender,
      birthDate: personal.birthDate,
      phoneNumber: personal.phoneNumber,
      imageUrl: personal.imageUrl,
    },
    languagePreference: user.languagePreference,
    themePreference: user.themePreference,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accountStatus: buildAccountStatus(user, personal),
  };
}
