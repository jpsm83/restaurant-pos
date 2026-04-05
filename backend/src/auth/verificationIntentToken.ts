import {
  VerificationIntent,
  type VerificationIntent as VerificationIntentKind,
} from "../../../packages/authVerificationIntent.ts";
import {
  computeEmailVerificationExpiry,
  computePasswordResetExpiry,
  generateRawEmailToken,
  hashEmailToken,
} from "./emailToken.ts";

export type IssuedVerificationIntentToken = {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
};

/**
 * V1: mint opaque token + hash + expiry for supported intents.
 * Future intents (`change_*`, `high_risk_*`) extend here when flows exist.
 */
export function createIntentTokenForVerificationIntent(
  intent: VerificationIntentKind,
): IssuedVerificationIntentToken {
  const rawToken = generateRawEmailToken();
  const tokenHash = hashEmailToken(rawToken);

  switch (intent) {
    case VerificationIntent.EmailConfirmation:
      return {
        rawToken,
        tokenHash,
        expiresAt: computeEmailVerificationExpiry(),
      };
    case VerificationIntent.PasswordReset:
      return {
        rawToken,
        tokenHash,
        expiresAt: computePasswordResetExpiry(),
      };
    default:
      throw new Error(
        `V1 token issuance not implemented for verification intent: ${intent}`,
      );
  }
}
