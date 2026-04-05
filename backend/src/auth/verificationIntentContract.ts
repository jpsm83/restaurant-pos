/**
 * Phase 6 — reusable verification-intent **contract** (types + docs).
 * V1 behavior lives in `requestEmailConfirmation`, `requestPasswordReset`, `confirmEmail`, `resetPassword`,
 * wired through `createIntentTokenForVerificationIntent`, `consumeVerificationIntent`, and audit logging.
 */

import type { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import type { IssuedVerificationIntentToken } from "./verificationIntentToken.ts";

/** Step 1 — mint material callers persist as hashes only. */
export type CreateIntentTokenResult = IssuedVerificationIntentToken;

/**
 * Step 2 — deliver a magic link (V1: `sendAuthTransactionalEmailWithRollback` in handlers).
 * Contract fields describe inputs; implementation is intent-specific templates + URLs.
 */
export type DeliverIntentLinkParams = {
  intent: VerificationIntent;
  toEmail: string;
  /** Absolute HTTPS (or dev HTTP) URL embedded in the email. */
  linkUrl: string;
  correlationId: string;
};

/** Step 3 — one-time verify + side effect (V1: confirm email or set password). */
export type ConsumeIntentSuccess = { ok: true; message: string };
export type ConsumeIntentFailure = {
  ok: false;
  kind: "client_error" | "server_error";
  message: string;
};
export type ConsumeIntentResult = ConsumeIntentSuccess | ConsumeIntentFailure;
