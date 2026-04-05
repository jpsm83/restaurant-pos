import { VerificationIntent } from "../../../packages/authVerificationIntent.ts";
import {
  type ConfirmEmailResult,
  handleConfirmEmail,
} from "./confirmEmail.ts";
import {
  handleResetPassword,
  type ResetPasswordResult,
} from "./resetPassword.ts";
import type {
  ConsumeIntentResult,
} from "./verificationIntentContract.ts";

function mapConfirmEmail(result: ConfirmEmailResult): ConsumeIntentResult {
  if (result.kind === "success") {
    return { ok: true, message: result.message };
  }
  if (result.kind === "client_error") {
    return {
      ok: false,
      kind: "client_error",
      message: result.message,
    };
  }
  return {
    ok: false,
    kind: "server_error",
    message: result.message,
  };
}

function mapResetPassword(result: ResetPasswordResult): ConsumeIntentResult {
  if (result.kind === "success") {
    return { ok: true, message: result.message };
  }
  if (result.kind === "client_error") {
    return {
      ok: false,
      kind: "client_error",
      message: result.message,
    };
  }
  return {
    ok: false,
    kind: "server_error",
    message: result.message,
  };
}

/**
 * Single entry point for **consume** step (Phase 6 contract). V1 supports email confirmation + password reset.
 */
export async function consumeVerificationIntent(
  intent: VerificationIntent,
  payload: { token: string; newPassword?: string },
): Promise<ConsumeIntentResult> {
  switch (intent) {
    case VerificationIntent.EmailConfirmation:
      return mapConfirmEmail(await handleConfirmEmail(payload.token));
    case VerificationIntent.PasswordReset:
      return mapResetPassword(
        await handleResetPassword(
          payload.token,
          payload.newPassword ?? "",
        ),
      );
    default:
      return {
        ok: false,
        kind: "server_error",
        message: "This verification intent is not supported yet.",
      };
  }
}
