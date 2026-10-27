import { useCallback, useMemo, useState, type BaseSyntheticEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { requestEmailChange } from "@/auth/api";
import emailRegex from "restaurant-pos-packages/utils/emailRegex";

export type ChangeBusinessEmailFormValues = {
  newEmail: string;
  currentPassword: string;
};

export type ChangeBusinessEmailController = {
  /** True while the change-email dialog is open. */
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  register: UseFormRegister<ChangeBusinessEmailFormValues>;
  fieldErrors: {
    newEmail?: string;
    currentPassword?: string;
  };
  isSubmitting: boolean;
  /** Submission failure copy (wrong password, duplicate email, network). */
  submitError: string | null;
  /**
   * New address awaiting confirmation after a successful request; drives the
   * "check your new inbox" success state. `null` until a request succeeds.
   */
  pendingEmail: string | null;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
};

function buildSchema(params: {
  currentEmail: string;
  required: string;
  invalidEmail: string;
  passwordRequired: string;
  sameEmail: string;
}) {
  const current = params.currentEmail.trim().toLowerCase();
  return z.object({
    newEmail: z
      .string()
      .trim()
      .min(1, params.required)
      .regex(emailRegex, params.invalidEmail)
      .refine(
        (value) => value.trim().toLowerCase() !== current,
        params.sameEmail,
      ),
    currentPassword: z.string().min(1, params.passwordRequired),
  });
}

/**
 * Drives the business "change sign-in email" action: validates the new address
 * and current password, calls the request endpoint, and tracks the pending
 * address for the success state. The server keeps the old email active until
 * the new address confirms the emailed link.
 */
export function useChangeBusinessEmailController(
  currentEmail: string,
): ChangeBusinessEmailController {
  const { t } = useTranslation("business");
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      buildSchema({
        currentEmail,
        required: t("profileSettings.changeEmail.errors.required"),
        invalidEmail: t("profileSettings.changeEmail.errors.invalidEmail"),
        passwordRequired: t(
          "profileSettings.changeEmail.errors.currentPasswordRequired",
        ),
        sameEmail: t("profileSettings.changeEmail.errors.sameEmail"),
      }),
    [currentEmail, t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeBusinessEmailFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  const openDialog = useCallback(() => {
    setSubmitError(null);
    setPendingEmail(null);
    reset({ newEmail: "", currentPassword: "" });
    setOpen(true);
  }, [reset]);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(null);

    const result = await requestEmailChange(
      values.newEmail.trim(),
      values.currentPassword,
    );

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setPendingEmail(values.newEmail.trim());
    reset({ newEmail: "", currentPassword: "" });
  });

  return {
    open,
    openDialog,
    closeDialog,
    register,
    fieldErrors: {
      newEmail: errors.newEmail?.message,
      currentPassword: errors.currentPassword?.message,
    },
    isSubmitting,
    submitError,
    pendingEmail,
    onSubmit: submitForm,
  };
}
