import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { isValidPassword } from "restaurant-pos-packages/utils/passwordPolicy";

import {
  changePassword,
  type PasswordChangeReauth,
} from "@/auth/api";
import { GoogleReauthButton } from "@/auth/GoogleReauthButton";
import { useGoogleSignInEnabled } from "@/auth/useGoogleSignInEnabled";
import type { AuthSession } from "@/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErrorMessage } from "@/i18n/errorCopy";
import type { ServiceRequestError } from "@/services/serviceErrors";

type ChangePasswordDialogProps = {
  open: boolean;
  hasGoogleIdentity?: boolean;
  hasPassword?: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (user: AuthSession | null) => void;
};

type LocalError =
  | "required"
  | "passwordRequired"
  | "passwordPolicy"
  | "passwordMismatch"
  | "currentPasswordIncorrect"
  | "googleReauthFailed"
  | null;

/**
 * Re-authenticated password set/change for the Sign-in & security page.
 * A password User proves the current password; a Google-only User proves a
 * linked Google identity; an account with both may use either proof.
 */
export function ChangePasswordDialog({
  open,
  hasGoogleIdentity = false,
  hasPassword = false,
  onOpenChange,
  onChanged,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation("customer");
  const resolveError = useErrorMessage();
  const googleSignInEnabled = useGoogleSignInEnabled();
  const fieldId = useId();
  const newPasswordId = `${fieldId}-new-password`;
  const confirmPasswordId = `${fieldId}-confirm-password`;
  const currentPasswordId = `${fieldId}-current-password`;
  const descriptionId = `${fieldId}-description`;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [localError, setLocalError] = useState<LocalError>(null);
  const [failure, setFailure] = useState<ServiceRequestError | null>(null);
  const [pending, setPending] = useState(false);

  const showGoogle = hasGoogleIdentity && googleSignInEnabled;
  const showPassword = hasPassword;
  const showPasswordDivider = showGoogle && showPassword;

  function resetFields() {
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
    setLocalError(null);
    setFailure(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetFields();
    onOpenChange(nextOpen);
  }

  function validateNewPassword(): boolean {
    if (!newPassword || !confirmPassword) {
      setLocalError("required");
      setFailure(null);
      return false;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("passwordMismatch");
      setFailure(null);
      return false;
    }
    if (!isValidPassword(newPassword)) {
      setLocalError("passwordPolicy");
      setFailure(null);
      return false;
    }
    return true;
  }

  function applyFieldError(error: ServiceRequestError): boolean {
    for (const fieldError of error.fieldErrors) {
      switch (fieldError.field) {
        case "currentPassword":
          setLocalError("currentPasswordIncorrect");
          return true;
        case "googleCredential":
          setLocalError("googleReauthFailed");
          return true;
        case "newPassword":
          setLocalError("passwordPolicy");
          return true;
        case "confirmPassword":
          setLocalError("passwordMismatch");
          return true;
      }
    }
    return false;
  }

  async function submit(reauth: PasswordChangeReauth) {
    setLocalError(null);
    setFailure(null);
    setPending(true);
    const result = await changePassword(newPassword, confirmPassword, reauth);
    setPending(false);

    if (!result.ok) {
      if (applyFieldError(result.error)) return;
      setFailure(result.error);
      return;
    }

    onChanged(result.data);
    handleOpenChange(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showPassword) return;
    if (!validateNewPassword()) return;
    if (!currentPassword) {
      setLocalError("passwordRequired");
      setFailure(null);
      return;
    }
    await submit({ currentPassword });
  }

  async function onGoogleCredential(credential: string) {
    if (!validateNewPassword()) return;
    await submit({ googleCredential: credential });
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
            {hasPassword
              ? t("security.password.dialogTitle")
              : t("security.password.dialogTitleSet")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id={descriptionId}
            className="mt-2 text-sm text-muted-foreground"
          >
            {t("security.password.dialogDescription")}
          </DialogPrimitive.Description>

          <form className="mt-4 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor={newPasswordId}>
                {t("security.password.newPasswordLabel")}
              </Label>
              <Input
                id={newPasswordId}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={confirmPasswordId}>
                {t("security.password.confirmPasswordLabel")}
              </Label>
              <Input
                id={confirmPasswordId}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
                {t("security.password.passwordAlternative")}
              </p>
            ) : null}

            {showPassword ? (
              <div className="space-y-2">
                <Label htmlFor={currentPasswordId}>
                  {t("security.password.currentPasswordLabel")}
                </Label>
                <Input
                  id={currentPasswordId}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
            ) : null}

            {localError ? (
              <p className="text-sm text-destructive" role="alert">
                {t(`security.password.errors.${localError}`)}
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
                {t("security.password.cancel")}
              </Button>
              {showPassword ? (
                <Button type="submit" disabled={pending}>
                  {pending
                    ? t("security.password.submitting")
                    : hasPassword
                      ? t("security.password.submitChange")
                      : t("security.password.submitSet")}
                </Button>
              ) : null}
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
