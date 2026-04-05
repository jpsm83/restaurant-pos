/**
 * Canonical verification-intent labels for auth and high-risk actions (Phase 6).
 * Backend V1 wires `email_confirmation` and `password_reset` via `verificationIntent*` modules.
 *
 * Values are stable snake_case strings suitable for storage, logs, and APIs.
 */

export const VerificationIntent = {
  EmailConfirmation: "email_confirmation",
  PasswordReset: "password_reset",
  ChangePasswordConfirmation: "change_password_confirmation",
  ChangeEmailConfirmation: "change_email_confirmation",
  HighRiskActionConfirmation: "high_risk_action_confirmation",
} as const;

export type VerificationIntent =
  (typeof VerificationIntent)[keyof typeof VerificationIntent];

const VALUES: readonly VerificationIntent[] = Object.values(VerificationIntent);

export function isVerificationIntent(value: string): value is VerificationIntent {
  return (VALUES as readonly string[]).includes(value);
}
