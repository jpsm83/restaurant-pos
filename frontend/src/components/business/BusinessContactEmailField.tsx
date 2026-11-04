import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BusinessContactEmailFieldProps = {
  registerEmail: UseFormRegisterReturn<"email">;
  readOnly?: boolean;
  hasStoredEmail: boolean;
  verified: boolean;
  verificationAction?: ReactNode;
};

/** Venue contact email with its stored verification state; read-only for non-admins. */
export function BusinessContactEmailField({
  registerEmail,
  readOnly = false,
  hasStoredEmail,
  verified,
  verificationAction,
}: BusinessContactEmailFieldProps) {
  const { t } = useTranslation("business");

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="bp-email">
        {t("profileSettings.core.fields.email")}
      </Label>
      <Input
        id="bp-email"
        type="email"
        autoComplete="email"
        readOnly={readOnly}
        aria-readonly={readOnly ? "true" : undefined}
        aria-describedby={
          hasStoredEmail ? "bp-email-verification" : undefined
        }
        {...registerEmail}
      />
      {hasStoredEmail ? (
        <p
          id="bp-email-verification"
          role="status"
          className={cn(
            "inline-flex rounded-md px-2 py-1 text-xs font-medium text-foreground",
            verified ? "bg-success/10" : "bg-warning/20",
          )}
        >
          {t(
            verified
              ? "profileSettings.core.emailVerification.verified"
              : "profileSettings.core.emailVerification.unverified",
          )}
        </p>
      ) : null}
      {verificationAction}
    </div>
  );
}
