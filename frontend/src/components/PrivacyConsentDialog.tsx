/**
 * Shared privacy-notice and account-terms acceptance dialog for the Google
 * entry path. Both auth pages reach it through `GoogleAuthButton`.
 *
 * Fully controlled: the parent owns the checkbox and validation state so the
 * step can gate the Google retry before any second request.
 */
import { useTranslation } from "react-i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FieldError";
import { cn } from "@/lib/utils";

type PrivacyConsentDialogProps = {
  open: boolean;
  providerName: string;
  accepted: boolean;
  showValidation: boolean;
  submitting?: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onAccept: () => void;
  onCancel: () => void;
  className?: string;
};

export function PrivacyConsentDialog({
  open,
  providerName,
  accepted,
  showValidation,
  submitting = false,
  onAcceptedChange,
  onAccept,
  onCancel,
  className,
}: PrivacyConsentDialogProps) {
  const { t } = useTranslation("auth");

  return (
    <DialogPrimitive.Root
      open={open}
      // Match the existing dialog pattern: no body-scroll lock/overlay scrollbar shift.
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogPrimitive.Portal>
        <div className="fixed inset-0 z-overlay bg-overlay" aria-hidden />
        <DialogPrimitive.Content
          aria-describedby="privacy-consent-description"
          className={cn(
            "fixed left-1/2 top-1/2 z-modal dialog-width max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-5 shadow-lg outline-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="text-base font-semibold text-popover-foreground">
            {t("privacyConsent.title")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id="privacy-consent-description"
            className="mt-2 text-sm text-muted-foreground"
          >
            {t("privacyConsent.description", { provider: providerName })}
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="privacy-consent-accepted"
                checked={accepted}
                onCheckedChange={(checked) => onAcceptedChange(checked === true)}
                aria-labelledby="privacy-consent-accepted-label"
                aria-invalid={showValidation ? true : undefined}
                disabled={submitting}
              />
              <Label
                id="privacy-consent-accepted-label"
                htmlFor="privacy-consent-accepted"
                className="text-sm leading-snug font-normal"
              >
                {t("privacyConsent.checkboxLabel")}
              </Label>
            </div>
            <FieldError
              message={
                showValidation ? t("privacyConsent.validationError") : undefined
              }
            />
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              {t("privacyConsent.cancel")}
            </Button>
            <Button type="button" onClick={onAccept} disabled={submitting}>
              {submitting
                ? t("privacyConsent.submitting")
                : t("privacyConsent.submit")}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
