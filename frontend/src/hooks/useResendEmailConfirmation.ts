import { useCallback, useState } from "react";
import { toast } from "sonner";
import { resendEmailConfirmation } from "@/auth/api";
import {
  isAlreadyVerifiedFailure,
  useErrorMessage,
} from "@/i18n/errorCopy";

/**
 * Sends a confirmation email for the current session account and reports the
 * outcome with local copy. An already-verified account is a success outcome;
 * the machine-code branch keeps that decision out of page-specific text.
 */
export function useResendEmailConfirmation(options: {
  successMessage: string;
  onSuccess?: () => void | Promise<void>;
}) {
  const { successMessage, onSuccess } = options;
  const resolveError = useErrorMessage();
  const [pending, setPending] = useState(false);

  const resend = useCallback(async () => {
    setPending(true);
    try {
      const result = await resendEmailConfirmation();
      if (result.ok) {
        toast.success(successMessage);
      } else if (isAlreadyVerifiedFailure(result.error)) {
        toast.success(resolveError(result.error));
      } else {
        toast.error(resolveError(result.error));
        return;
      }
      await onSuccess?.();
    } finally {
      setPending(false);
    }
  }, [onSuccess, resolveError, successMessage]);

  return { resend, pending };
}
