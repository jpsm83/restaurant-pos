/**
 * Google sign-in verification seam.
 *
 * The client posts a Google ID token; this module verifies issuer, audience,
 * signature, and expiry through Google's library and then requires a verified
 * email before exposing the claims. Tests replace the verifier with a
 * deterministic fake, so no test calls Google.
 */
import { OAuth2Client, type TokenPayload } from "google-auth-library";

export interface GoogleIdentity {
  /** Google `sub`; stored as `User.googleId`. */
  subject: string;
  /** Verified, normalized sign-in email. */
  email: string;
  firstName?: string;
  lastName?: string;
}

export type GoogleVerifier = (credential: string) => Promise<GoogleIdentity>;

export class GoogleCredentialError extends Error {
  constructor(message = "Invalid Google credential") {
    super(message);
    this.name = "GoogleCredentialError";
  }
}

function optionalName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Turn verified token claims into the identity the auth route may trust. */
export function toGoogleIdentity(
  claims: Partial<TokenPayload> | null | undefined,
): GoogleIdentity {
  if (
    !claims ||
    typeof claims.sub !== "string" ||
    !claims.sub.trim() ||
    typeof claims.email !== "string" ||
    !claims.email.trim() ||
    claims.email_verified !== true
  ) {
    throw new GoogleCredentialError();
  }

  const firstName = optionalName(claims.given_name);
  const lastName = optionalName(claims.family_name);

  return {
    subject: claims.sub.trim(),
    email: claims.email.toLowerCase().trim(),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
}

/**
 * Build the production verifier, or `null` when no Google client id is
 * configured (the endpoint stays unavailable and the button stays hidden).
 */
export function createGoogleVerifier(
  clientId: string | undefined,
): GoogleVerifier | null {
  const audience = clientId?.trim();
  if (!audience) return null;

  const client = new OAuth2Client(audience);

  return async (credential) => {
    let claims: TokenPayload | undefined;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience,
      });
      claims = ticket.getPayload();
    } catch {
      throw new GoogleCredentialError();
    }

    return toGoogleIdentity(claims);
  };
}
