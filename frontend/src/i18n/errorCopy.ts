/**
 * Machine error code → localized copy.
 *
 * Services emit a `ServiceFailure` code; this map decides which namespace/key
 * explains it. UI surfaces call `useErrorMessage` (or the pure
 * `resolveErrorMessage`) instead of branching on server strings.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { NAMESPACES } from "./config";
import {
  makeServiceErrorCode,
  SERVICE_ERROR_OUTCOMES,
  SERVICE_OPERATIONS,
  type ServiceErrorCode,
  type ServiceErrorOutcome,
  type ServiceFailure,
} from "@/services/serviceErrors";

export type ErrorCopyNamespace = (typeof NAMESPACES)[number];

export interface ErrorCopy {
  namespace: ErrorCopyNamespace;
  key: string;
  values: Record<string, unknown>;
}

export type ErrorCopyTemplate = {
  namespace: ErrorCopyNamespace;
  key: string;
  values?: (failure: ServiceFailure) => Record<string, unknown>;
};

export type ErrorTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

const GENERIC_OUTCOME_COPY: Record<ServiceErrorOutcome, ErrorCopyTemplate> = {
  validation: {
    namespace: "errors",
    key: "api.validation",
    values: (failure) => ({
      count: Math.max(1, failure.fieldErrors?.length ?? 0),
    }),
  },
  badRequest: { namespace: "errors", key: "api.badRequest" },
  unauthorized: { namespace: "errors", key: "api.unauthorized" },
  forbidden: { namespace: "errors", key: "api.forbidden" },
  notFound: { namespace: "errors", key: "api.notFound" },
  conflict: { namespace: "errors", key: "api.conflict" },
  internal: { namespace: "errors", key: "api.internal" },
  transport: { namespace: "errors", key: "api.transport" },
};

const OVERRIDES: Partial<Record<ServiceErrorCode, ErrorCopyTemplate>> = {
  "signIn.unauthorized": { namespace: "auth", key: "api.invalidCredentials" },
  "signUp.conflict": { namespace: "auth", key: "api.emailInUse" },
  "googleAuth.unauthorized": { namespace: "auth", key: "api.googleAuthFailed" },
  "googleAuth.badRequest": { namespace: "auth", key: "api.googleAuthFailed" },
  "googleAuth.forbidden": { namespace: "auth", key: "api.googleAuthFailed" },
  "googleAuth.conflict": {
    namespace: "auth",
    key: "api.googleEmailConflict",
  },
  "googleAuth.notFound": { namespace: "auth", key: "api.googleAuthFailed" },
  "googleAuth.validation": { namespace: "auth", key: "api.googleAuthFailed" },
  "googleAuth.internal": { namespace: "auth", key: "api.googleAuthFailed" },
  "googleAuth.transport": { namespace: "auth", key: "api.googleAuthFailed" },
  "confirmEmail.validation": {
    namespace: "auth",
    key: "api.invalidConfirmationLink",
  },
  "confirmEmail.badRequest": {
    namespace: "auth",
    key: "api.invalidConfirmationLink",
  },
  "confirmEmail.notFound": {
    namespace: "auth",
    key: "api.invalidConfirmationLink",
  },
  "resendConfirmation.unauthorized": {
    namespace: "auth",
    key: "api.signInRequired",
  },
  /**
   * The authenticated resend endpoint only returns 400 for an account whose
   * email is already verified; validation failures use the `validation` code.
   */
  "resendConfirmation.badRequest": {
    namespace: "auth",
    key: "api.emailAlreadyVerified",
  },
  "emailChange.unauthorized": {
    namespace: "auth",
    key: "api.currentPasswordIncorrect",
  },
  "emailChange.conflict": {
    namespace: "auth",
    key: "api.emailInUse",
  },
  "emailChange.validation": {
    namespace: "auth",
    key: "api.invalidNewEmail",
  },
  "emailChange.badRequest": {
    namespace: "auth",
    key: "api.invalidNewEmail",
  },
  "emailChange.notFound": {
    namespace: "auth",
    key: "api.emailChangeFailed",
  },
  "emailChange.internal": {
    namespace: "auth",
    key: "api.emailChangeFailed",
  },
  "emailChange.transport": {
    namespace: "auth",
    key: "api.emailChangeFailed",
  },
  "confirmEmailChange.validation": {
    namespace: "auth",
    key: "api.invalidEmailChangeLink",
  },
  "confirmEmailChange.badRequest": {
    namespace: "auth",
    key: "api.invalidEmailChangeLink",
  },
  "confirmEmailChange.notFound": {
    namespace: "auth",
    key: "api.invalidEmailChangeLink",
  },
  "passwordReset.validation": {
    namespace: "auth",
    key: "api.invalidResetLink",
  },
  "passwordReset.badRequest": {
    namespace: "auth",
    key: "api.invalidResetLink",
  },
  "passwordReset.notFound": {
    namespace: "auth",
    key: "api.invalidResetLink",
  },
  "businessFetch.notFound": {
    namespace: "business",
    key: "errors.notFound",
  },
  "businessUpdate.conflict": {
    namespace: "business",
    key: "errors.updateConflict",
  },
  "modeLoad.unauthorized": { namespace: "auth", key: "api.signInRequired" },
  "modeSave.forbidden": { namespace: "mode", key: "errors.notAllowed" },
};

function buildErrorCopyMap(): Record<ServiceErrorCode, ErrorCopyTemplate> {
  const map = {} as Record<ServiceErrorCode, ErrorCopyTemplate>;
  for (const operation of SERVICE_OPERATIONS) {
    for (const outcome of SERVICE_ERROR_OUTCOMES) {
      const code = makeServiceErrorCode(operation, outcome);
      map[code] = OVERRIDES[code] ?? GENERIC_OUTCOME_COPY[outcome];
    }
  }
  return map;
}

/** One map entry per service operation × outcome. */
export const ERROR_COPY: Record<ServiceErrorCode, ErrorCopyTemplate> =
  buildErrorCopyMap();

const FALLBACK_COPY: ErrorCopyTemplate = GENERIC_OUTCOME_COPY.transport;

/**
 * True when a failure is the existing-account branch of a confirmation resend.
 * The API has no dedicated status for it, and this operation maps 400 to the
 * already-verified outcome, so pages must branch on the machine code.
 */
export function isAlreadyVerifiedFailure(
  failure: Pick<ServiceFailure, "code"> | null | undefined,
): boolean {
  return failure?.code === "resendConfirmation.badRequest";
}

/** Resolves a failure code to the localized namespace, key, and values. */
export type ErrorFailure = Pick<
  ServiceFailure,
  "code" | "status" | "fieldErrors"
>;

export function getErrorCopy(
  failure: ErrorFailure | null | undefined,
): ErrorCopy {
  const template =
    (failure && ERROR_COPY[failure.code]) || FALLBACK_COPY;
  return {
    namespace: template.namespace,
    key: template.key,
    values: template.values
      ? template.values({
          code: failure?.code ?? "session.transport",
          status: failure?.status,
          fieldErrors: failure?.fieldErrors ?? [],
        })
      : {},
  };
}

/** Pure resolver used by tests and non-React callers. */
export function resolveErrorMessage(
  failure: ErrorFailure | null | undefined,
  translate: ErrorTranslator,
): string {
  if (!failure) return "";
  const copy = getErrorCopy(failure);
  return translate(`${copy.namespace}:${copy.key}`, copy.values);
}

/**
 * The single resolver UI surfaces use. Subscribing through `useTranslation`
 * re-renders when the active language changes.
 */
export function useErrorMessage(): (
  failure: ErrorFailure | null | undefined,
) => string {
  const { t } = useTranslation();
  return useCallback(
    (failure) => resolveErrorMessage(failure, t as ErrorTranslator),
    [t],
  );
}
