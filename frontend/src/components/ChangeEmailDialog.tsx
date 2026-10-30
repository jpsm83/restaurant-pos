import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { emailSchema } from "restaurant-pos-packages/schemas/primitives";

import { requestEmailChange, type EmailChangeReauth } from "@/auth/api";
import { GoogleReauthButton } from "@/auth/GoogleReauthButton";
import { useGoogleSignInEnabled } from "@/auth/useGoogleSignInEnabled";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErrorMessage } from "@/i18n/errorCopy";
import type { ServiceRequestError } from "@/services/serviceErrors";

type ChangeEmailDialogProps = {
  open: boolean;
  currentEmail: string;
  hasGoogleIdentity?: boolean;
  hasPassword?: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: () => void;
};

type LocalError =
  | "invalidEmail"
  | "passwordRequired"
  | "sameEmail"
  | "googleReauthFailed"
  | null;

/**
 * Password re-authentication and new-address entry for a sign-in email change.
 * The dialog only starts the request; the sign-in email changes after the link
 * sent to the new address is confirmed.
 */
export function ChangeEmailDialog({
  open,
  currentEmail,
  hasGoogleIdentity = false,
  hasPassword = false,
  onOpenChange,
  onRequested,
}: ChangeEmailDialogProps) {
  const { t } = useTranslation("customer");
  const resolveError = useErrorMessage();
  const googleSignInEnabled = useGoogleSignInEnabled();
  const fieldId = useId();
  const newEmailId = `${fieldId}-new-email`;
  const passwordId = `${fieldId}-current-password`;
  const descriptionId = `${fieldId}-description`;

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [localError, setLocalError] = useState<LocalError>(null);
  const [failure, setFailure] = useState<ServiceRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const showGoogle = hasGoogleIdentity && googleSignInEnabled;
  const showPassword = !showGoogle || hasPassword;
  const showPasswordDivider = showGoogle && showPassword;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setNewEmail("");
      setCurrentPassword("");
      setLocalError(null);
      setFailure(null);
    }
    onOpenChange(nextOpen);
  }

  function validatedNewEmail(): string | null {
    const normalized = newEmail.trim().toLowerCase();
    const parsed = emailSchema.safeParse(normalized);
    if (!parsed.success) {
      setLocalError("invalidEmail");
      setFailure(null);
      return null;
    }
    if (normalized === currentEmail.trim().toLowerCase()) {
      setLocalError("sameEmail");
      setFailure(null);
      return null;
    }
    return normalized;
  }

  async function submitReauth(
    normalized: string,
    reauth: EmailChangeReauth,
  ) {
    setLocalError(null);
    setFailure(null);
    setPending(true);
    const result = await requestEmailChange(normalized, reauth);
    setPending(false);

    if (!result.ok) {
      if (
        "googleCredential" in reauth &&
        result.error.code === "emailChange.unauthorized"
      ) {
        setLocalError("googleReauthFailed");
        return;
      }
      setFailure(result.error);
      return;
    }

    onRequested();
    handleOpenChange(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showPassword) return;

    const normalized = validatedNewEmail();
    if (!normalized) return;
    if (!currentPassword) {
      setLocalError("passwordRequired");
      setFailure(null);
      return;
    }

    await submitReauth(normalized, { currentPassword });
  }

  async function onGoogleCredential(credential: string) {
    const normalized = validatedNewEmail();
    if (!normalized) return;
    await submitReauth(normalized, { googleCredential: credential });
  }

  return (
    <DialogPrimitive.Root open={open} modal={false} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <div className="fixed inset-0 z-overlay bg-overlay" aria-hidden />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          className="fixed left-1/2 top-1/2 z-modal dialog-width max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-5 shadow-lg outline-none"
        >
          <DialogPrimitive.Title className="text-base font-semibold text-popover-foreground">
            {t("profile.changeEmail.title")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id={descriptionId}
            className="mt-2 text-sm text-muted-foreground"
          >
            {t("profile.changeEmail.description")}
          </DialogPrimitive.Description>

          <form className="mt-4 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor={newEmailId}>
                {t("profile.changeEmail.newEmailLabel")}
              </Label>
              <Input
                id={newEmailId}
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
              />
            </div>
            {showGoogle ? (
              <GoogleReauthButton
                onCredential={(credential) => void onGoogleCredential(credential)}
                onFailure={() => {
                  setLocalError("googleReauthFailed");
                  setFailure(null);
                }}
                disabled={pending}
              />
            ) : null}

            {showPasswordDivider ? (
              <p className="text-center text-xs text-muted-foreground">
                {t("profile.changeEmail.passwordAlternative")}
              </p>
            ) : null}

            {showPassword ? (
              <div className="space-y-2">
                <Label htmlFor={passwordId}>
                  {t("profile.changeEmail.currentPasswordLabel")}
                </Label>
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
            ) : null}

            {localError ? (
              <p className="text-sm text-destructive" role="alert">
                {t(`profile.changeEmail.errors.${localError}`)}
              </p>
            ) : null}
            {failure ? (
              <p className="text-sm text-destructive" role="alert">
                {resolveError(failure)}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t("profile.changeEmail.cancel")}
              </Button>
              {showPassword ? (
                <Button type="submit" disabled={pending}>
                  {pending
                    ? t("profile.changeEmail.submitting")
                    : t("profile.changeEmail.submit")}
                </Button>
              ) : null}
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
