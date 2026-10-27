import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { FieldError } from "@/components/FieldError";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChangeBusinessEmailController } from "@/hooks/useChangeBusinessEmailController";
import { useErrorMessage } from "@/i18n/errorCopy";

/**
 * Modal for the business "change sign-in email" action. Collects the new
 * address and current password, then calls the request endpoint via the
 * controller. On success it swaps to a "check your new inbox" confirmation and
 * surfaces the pending address. Radix owns focus trap/restore so the action
 * matches {@link UnsavedChangesDialog}.
 */
export function ChangeEmailDialog({
  controller,
}: {
  controller: ChangeBusinessEmailController;
}) {
  const { t } = useTranslation("business");
  const resolveError = useErrorMessage();
  const descriptionId = useId();
  const {
    open,
    closeDialog,
    register,
    fieldErrors,
    isSubmitting,
    submitError,
    pendingEmail,
    onSubmit,
  } = controller;

  return (
    <DialogPrimitive.Root
      open={open}
      // Non-modal avoids `react-remove-scroll` on the document, matching `UnsavedChangesDialog`.
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeDialog();
      }}
    >
      <DialogPrimitive.Portal>
        {
          /* Radix omits `Dialog.Overlay` when `modal={false}`; this div does not use RemoveScroll. */
        }
        <div className="fixed inset-0 z-overlay bg-overlay" aria-hidden />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          className="fixed left-1/2 top-1/2 z-modal dialog-width max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-5 shadow-lg outline-none"
        >
          <DialogPrimitive.Title className="text-base font-semibold text-popover-foreground">
            {t("profileSettings.changeEmail.dialogTitle")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id={descriptionId}
            className="mt-2 text-sm text-muted-foreground"
          >
            {t("profileSettings.changeEmail.dialogDescription")}
          </DialogPrimitive.Description>

          {pendingEmail ? (
            <div className="mt-4 space-y-4">
              <div
                className="rounded-md border border-warning/40 bg-warning/20 px-3 py-3 text-sm text-foreground"
                role="status"
              >
                <p className="font-medium text-foreground">
                  {t("profileSettings.changeEmail.successTitle")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("profileSettings.changeEmail.successBody", {
                    email: pendingEmail,
                  })}
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {t("profileSettings.changeEmail.close")}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="mt-4 space-y-4"
              noValidate
              onSubmit={(event) => void onSubmit(event)}
            >
              <div className="space-y-2">
                <Label htmlFor="change-email-new">
                  {t("profileSettings.changeEmail.fields.newEmail")}
                </Label>
                <Input
                  id="change-email-new"
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldErrors.newEmail ? true : undefined}
                  {...register("newEmail")}
                />
                <FieldError message={fieldErrors.newEmail} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="change-email-current-password">
                  {t("profileSettings.changeEmail.fields.currentPassword")}
                </Label>
                <Input
                  id="change-email-current-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={
                    fieldErrors.currentPassword ? true : undefined
                  }
                  {...register("currentPassword")}
                />
                <FieldError message={fieldErrors.currentPassword} />
              </div>

              {submitError ? (
                <Alert>{resolveError(submitError)}</Alert>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  disabled={isSubmitting}
                >
                  {t("profileSettings.changeEmail.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? t("profileSettings.changeEmail.submitting")
                    : t("profileSettings.changeEmail.submit")}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
