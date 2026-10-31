/**
 * Shared Google entry button for the sign-in and sign-up forms.
 *
 * The Google provider returns an ID token; the API verifies it and resolves
 * the same account the email/password forms use. A failed credential maps to
 * the localized auth failure copy through the normal machine-code rail.
 *
 * When Google would create a new User the API answers with `consentRequired`
 * instead of a session. The shared button then opens the acceptance dialog,
 * keeps the credential, and retries with the acceptance proof on accept.
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
import type { AuthSession } from "@/auth/types";
import { isSupportedLanguage } from "@/i18n/config";
import type { ErrorFailure } from "@/i18n/errorCopy";
import { PrivacyConsentDialog } from "@/components/PrivacyConsentDialog";

interface GoogleAuthButtonProps {
  onFailure: (failure: ErrorFailure) => void;
}

type GoogleAuthOutcome =
  | { kind: "success"; user: AuthSession }
  | { kind: "consent_required" }
  /** The outcome was already surfaced (failure, reactivation, or internal). */
  | { kind: "no_session" };

export function GoogleAuthButton({ onFailure }: GoogleAuthButtonProps) {
  if (!getGoogleClientId()) return null;
  return <EnabledGoogleAuthButton onFailure={onFailure} />;
}

function EnabledGoogleAuthButton({ onFailure }: GoogleAuthButtonProps) {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getReturnToParam(location.search);
  const { dispatch } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentValidation, setConsentValidation] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<string | null>(
    null,
  );
  const { data: authConfig } = useAuthConfigQuery();

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

  const runGoogleAuth = async (
    credential: string,
    privacyAccepted?: boolean,
  ): Promise<GoogleAuthOutcome> => {
    setSubmitting(true);
    dispatch({ type: "AUTH_LOADING" });

    const result = await googleAuth({
      credential,
      ...(privacyAccepted ? { privacyAccepted } : {}),
      ...(languagePreference ? { languagePreference } : {}),
    });

    setSubmitting(false);

    if (!result.ok) {
      dispatch({ type: "AUTH_ERROR", payload: result.error.code });
      onFailure(result.error);
      return { kind: "no_session" };
    }

    if (result.data?.consentRequired) {
      dispatch({ type: "AUTH_CLEAR" });
      return { kind: "consent_required" };
    }

    if (!result.data?.user) {
      dispatch({ type: "AUTH_CLEAR" });
      if (result.data?.reactivationRequired) {
        toast.info(t("login.reactivationRequired"));
        return { kind: "no_session" };
      }
      const failure: ErrorFailure = { code: "googleAuth.internal" };
      dispatch({ type: "AUTH_ERROR", payload: failure.code });
      onFailure(failure);
      return { kind: "no_session" };
    }

    return { kind: "success", user: result.data.user };
  };

  const resetConsent = () => {
    setConsentOpen(false);
    setConsentAccepted(false);
    setConsentValidation(false);
    setPendingCredential(null);
  };

  const openConsent = (credential: string) => {
    resetConsent();
    setPendingCredential(credential);
    setConsentOpen(true);
  };

  const handleCredential = async (credential: string | undefined) => {
    if (submitting || consentOpen) return;
    if (!credential) {
      onFailure({ code: "googleAuth.unauthorized" });
      return;
    }

    const outcome = await runGoogleAuth(credential);
    if (outcome.kind === "consent_required") {
      openConsent(credential);
      return;
    }
    if (outcome.kind === "success") completeSession(outcome.user);
  };

  const handleConsentAccept = async () => {
    if (!pendingCredential || submitting) return;
    if (!consentAccepted) {
      setConsentValidation(true);
      return;
    }

    const credential = pendingCredential;
    setConsentValidation(false);

    const outcome = await runGoogleAuth(credential, true);
    resetConsent();

    if (outcome.kind === "success") {
      completeSession(outcome.user);
      return;
    }
    if (outcome.kind === "consent_required") openConsent(credential);
  };

  const handleConsentCancel = () => {
    if (submitting) return;
    resetConsent();
    dispatch({ type: "AUTH_CLEAR" });
  };

  const handleError = () => {
    if (submitting || consentOpen) return;
    const failure: ErrorFailure = { code: "googleAuth.unauthorized" };
    dispatch({ type: "AUTH_ERROR", payload: failure.code });
    onFailure(failure);
  };

  return (
    <div className="flex justify-center">
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
          "aria-disabled": submitting || consentOpen,
          inert: submitting || consentOpen,
        }}
      />
      <PrivacyConsentDialog
        open={consentOpen}
        providerName="Google"
        accepted={consentAccepted}
        showValidation={consentValidation}
        submitting={submitting}
        onAcceptedChange={setConsentAccepted}
        onAccept={() => void handleConsentAccept()}
        onCancel={handleConsentCancel}
      />
    </div>
  );
}
