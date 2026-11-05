/**
 * Shared Google entry button for the sign-in and sign-up forms.
 *
 * The Google provider returns an ID token; the API verifies it and resolves
 * the same account the email/password forms use. A failed credential maps to
 * the localized auth failure copy through the normal machine-code rail.
 *
 * The sign-in surface sends `intent: "signin"`, which never creates an
 * account. The sign-up surface sends `intent: "signup"` plus the form's
 * acceptance proof. Until the acceptance checkbox is checked the control is
 * inert, and a stray credential attempt still refuses to call the API and
 * asks the form to surface its acceptance validation.
 */
import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { googleAuth, useAuthConfigQuery } from "@/auth/api";
import { getGoogleClientId } from "@/auth/google";
import {
  getPostLoginDestination,
  getReturnToParam,
} from "@/auth/postLoginRedirect";
import { markPriorSession } from "@/auth/sessionHint";
import { useAuth } from "@/auth/store/AuthContext";
import type { AuthSession, GoogleAuthIntent } from "@/auth/types";
import { isSupportedLanguage } from "@/i18n/config";
import type { ErrorFailure } from "@/i18n/errorCopy";

interface GoogleAuthButtonProps {
  intent: GoogleAuthIntent;
  onFailure: (failure: ErrorFailure) => void;
  /** The sign-up form's privacy/terms acceptance value. */
  privacyAccepted?: boolean;
  /** Ask the sign-up form to surface its acceptance validation. */
  onAcceptanceRequired?: () => void;
}

type GoogleAuthOutcome =
  | { kind: "success"; user: AuthSession }
  /** The outcome was already surfaced (failure, reactivation, or internal). */
  | { kind: "no_session" };

export function GoogleAuthButton({
  intent,
  onFailure,
  privacyAccepted,
  onAcceptanceRequired,
}: GoogleAuthButtonProps) {
  if (!getGoogleClientId()) return null;
  return (
    <EnabledGoogleAuthButton
      intent={intent}
      onFailure={onFailure}
      privacyAccepted={privacyAccepted}
      onAcceptanceRequired={onAcceptanceRequired}
    />
  );
}

function EnabledGoogleAuthButton({
  intent,
  onFailure,
  privacyAccepted,
  onAcceptanceRequired,
}: GoogleAuthButtonProps) {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getReturnToParam(location.search);
  const { dispatch } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { data: authConfig } = useAuthConfigQuery();
  const canCreateAccount = intent === "signup";
  const requiresAcceptance = canCreateAccount && privacyAccepted !== true;

  const language = (i18n.resolvedLanguage ?? i18n.language ?? "")
    .split("-")[0]
    .toLowerCase();
  const languagePreference = isSupportedLanguage(language)
    ? language
    : undefined;

  if (authConfig?.googleSignInEnabled !== true) return null;

  const completeSession = (sessionUser: AuthSession) => {
    markPriorSession();
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    if (sessionUser.emailVerified === false) {
      toast.info(t("login.verifyEmailToast"));
    }
    navigate(getPostLoginDestination(returnTo), { replace: true });
  };

  const runGoogleAuth = async (credential: string): Promise<GoogleAuthOutcome> => {
    setSubmitting(true);

    try {
      const result = await googleAuth({
        credential,
        intent,
        ...(canCreateAccount && privacyAccepted === true
          ? { privacyAccepted: true }
          : {}),
        ...(languagePreference ? { languagePreference } : {}),
      });

      if (!result.ok) {
        onFailure(result.error);
        return { kind: "no_session" };
      }

      if (!result.data?.user) {
        if (result.data?.reactivationRequired) {
          toast.info(t("login.reactivationRequired"));
          return { kind: "no_session" };
        }
        const failure: ErrorFailure = { code: "googleAuth.internal" };
        onFailure(failure);
        return { kind: "no_session" };
      }

      return { kind: "success", user: result.data.user };
    } finally {
      setSubmitting(false);
    }
  };

  const refuseMissingAcceptance = () => {
    if (!requiresAcceptance) return false;
    onAcceptanceRequired?.();
    return true;
  };

  const handleCredential = async (credential: string | undefined) => {
    if (submitting || refuseMissingAcceptance()) return;
    if (!credential) {
      onFailure({ code: "googleAuth.unauthorized" });
      return;
    }

    const outcome = await runGoogleAuth(credential);
    if (outcome.kind === "success") completeSession(outcome.user);
  };

  const handleError = () => {
    if (submitting || refuseMissingAcceptance()) return;
    onFailure({ code: "googleAuth.unauthorized" });
  };

  return (
    <div className="flex justify-center">
      <div className="relative inline-flex">
        <GoogleLogin
          onSuccess={(response) => void handleCredential(response.credential)}
          onError={handleError}
          useOneTap={false}
          text="continue_with"
          shape="rectangular"
          theme="outline"
          size="large"
          {...(languagePreference ? { locale: languagePreference } : {})}
          containerProps={{
            "aria-busy": submitting,
            "aria-disabled": submitting || requiresAcceptance,
            inert: submitting || requiresAcceptance,
          }}
        />
        {requiresAcceptance ? (
          <button
            type="button"
            onClick={() => onAcceptanceRequired?.()}
            aria-label={t("signup.googleAcceptanceRequired")}
            className="absolute inset-0 z-overlay cursor-not-allowed rounded-md focus-visible:ring-3 focus-visible:ring-ring"
          />
        ) : null}
      </div>
    </div>
  );
}
