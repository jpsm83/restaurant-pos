/**
 * Shared Google entry button for the sign-in and sign-up forms.
 *
 * The Google provider returns an ID token; the API verifies it and resolves
 * the same account the email/password forms use. A failed credential maps to
 * the localized auth failure copy through the normal machine-code rail.
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
import { isSupportedLanguage } from "@/i18n/config";
import type { ErrorFailure } from "@/i18n/errorCopy";

interface GoogleAuthButtonProps {
  onFailure: (failure: ErrorFailure) => void;
}

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
  const { data: authConfig } = useAuthConfigQuery();

  const language = (i18n.resolvedLanguage ?? i18n.language ?? "")
    .split("-")[0]
    .toLowerCase();
  const languagePreference = isSupportedLanguage(language)
    ? language
    : undefined;

  if (authConfig?.googleSignInEnabled !== true) return null;

  const handleCredential = async (credential: string | undefined) => {
    if (submitting) return;
    if (!credential) {
      onFailure({ code: "googleAuth.unauthorized" });
      return;
    }

    setSubmitting(true);
    dispatch({ type: "AUTH_LOADING" });

    const result = await googleAuth({
      credential,
      ...(languagePreference ? { languagePreference } : {}),
    });

    setSubmitting(false);

    if (!result.ok) {
      dispatch({ type: "AUTH_ERROR", payload: result.error.code });
      onFailure(result.error);
      return;
    }

    if (!result.data?.user) {
      dispatch({ type: "AUTH_CLEAR" });
      if (result.data?.reactivationRequired) {
        toast.info(t("login.reactivationRequired"));
        return;
      }
      const failure: ErrorFailure = { code: "googleAuth.internal" };
      dispatch({ type: "AUTH_ERROR", payload: failure.code });
      onFailure(failure);
      return;
    }

    markPriorSession();
    const sessionUser = result.data.user;
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    if (sessionUser.emailVerified === false) {
      toast.info(t("login.verifyEmailToast"));
    }
    navigate(getPostLoginDestination(sessionUser, returnTo), { replace: true });
  };

  const handleError = () => {
    if (submitting) return;
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
          "aria-disabled": submitting,
          inert: submitting,
        }}
      />
    </div>
  );
}
