import { GoogleCredentialError, type GoogleVerifier } from "./google.ts";

/**
 * A verified Google credential re-authenticates only when it resolves to the
 * exact Google subject already linked to this User.
 */
export async function matchesLinkedGoogleIdentity(
  linkedSubject: unknown,
  credential: string,
  verifier: GoogleVerifier | null | undefined,
): Promise<boolean> {
  if (typeof linkedSubject !== "string" || !linkedSubject || !verifier) {
    return false;
  }

  try {
    const identity = await verifier(credential);
    return identity.subject === linkedSubject;
  } catch (error) {
    if (error instanceof GoogleCredentialError) return false;
    throw error;
  }
}
