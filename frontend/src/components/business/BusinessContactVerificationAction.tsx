import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useErrorMessage } from "@/i18n/errorCopy";
import {
  useRequestBusinessContactVerificationMutation,
  type BusinessContactVerificationOutcome,
} from "@/services/business/businessService";
import { toServiceRequestError } from "@/services/serviceErrors";

function verificationOutcomeMessage(
  outcome: BusinessContactVerificationOutcome,
  t: TFunction<"business">,
): string {
  switch (outcome) {
    case "sent":
      return t("profileSettings.core.emailVerification.requestSuccess");
    case "already_verified":
      return t("profileSettings.core.emailVerification.alreadyVerified");
    case "cooldown":
      return t("profileSettings.core.emailVerification.cooldown");
  }
}

type BusinessContactVerificationActionProps = {
  businessId: string;
  hasStoredEmail: boolean;
  verified: boolean;
  canRequest: boolean;
};

/** Admin/Owner action that asks the server to send one venue contact-verification email. */
export function BusinessContactVerificationAction({
  businessId,
  hasStoredEmail,
  verified,
  canRequest,
}: BusinessContactVerificationActionProps) {
  const { t } = useTranslation("business");
  const resolveError = useErrorMessage();
  const mutation = useRequestBusinessContactVerificationMutation();
  const [message, setMessage] = useState<string | null>(null);

  if (!canRequest || verified) return null;

  if (!hasStoredEmail) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("profileSettings.core.emailVerification.noEmail")}
      </p>
    );
  }

  const requestVerification = async () => {
    setMessage(null);
    try {
      const result = await mutation.mutateAsync(businessId);
      setMessage(verificationOutcomeMessage(result.outcome, t));
    } catch (error) {
      setMessage(
        resolveError(
          toServiceRequestError(error, "businessContactVerification"),
        ),
      );
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => void requestVerification()}
      >
        {mutation.isPending
          ? t("profileSettings.core.emailVerification.requestPending")
          : t("profileSettings.core.emailVerification.requestAction")}
      </Button>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
