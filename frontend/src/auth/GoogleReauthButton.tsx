/**
 * Google re-authentication control for the sign-in email-change dialog.
 *
 * Unlike the sign-in button it never creates a session: it only hands the
 * verified Google ID token back to the caller as a re-authentication proof.
 */
import { GoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";

import { useGoogleSignInEnabled } from "@/auth/useGoogleSignInEnabled";
import { isSupportedLanguage } from "@/i18n/config";

interface GoogleReauthButtonProps {
  onCredential: (credential: string) => void;
  onFailure: () => void;
  disabled?: boolean;
}

export function GoogleReauthButton({
  onCredential,
  onFailure,
  disabled = false,
}: GoogleReauthButtonProps) {
  const { i18n } = useTranslation();
  const enabled = useGoogleSignInEnabled();

  const language = (i18n.resolvedLanguage ?? i18n.language ?? "")
    .split("-")[0]
    .toLowerCase();
  const languagePreference = isSupportedLanguage(language)
    ? language
    : undefined;

  if (!enabled) return null;

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={(response) => {
          if (disabled) return;
          if (!response.credential) {
            onFailure();
            return;
          }
          onCredential(response.credential);
        }}
        onError={() => {
          if (!disabled) onFailure();
        }}
        useOneTap={false}
        text="continue_with"
        shape="rectangular"
        theme="outline"
        size="large"
        {...(languagePreference ? { locale: languagePreference } : {})}
        containerProps={{
          "aria-busy": disabled,
          "aria-disabled": disabled,
          inert: disabled,
        }}
      />
    </div>
  );
}
