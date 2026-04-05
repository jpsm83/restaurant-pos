"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import requestPasswordResetAction from "@/app/actions/auth/requestPasswordReset";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/Toasts";

interface FormData {
  email: string;
}

interface ForgotPasswordProps {
  locale: string;
}

export default function ForgotPassword({ locale }: ForgotPasswordProps) {
  const t = useTranslations("ForgotPassword");

  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    clearErrors,
  } = useForm<FormData>({
    mode: "onChange",
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);

    try {
      const result = await requestPasswordResetAction(data.email);

      if (result.success) {
        showToast(
          "success",
          t("resetEmailSent"),
          result.message || t("checkEmailInstructions")
        );
        // Clear the form on success
        setValue("email", "");
      } else {
        showToast(
          "error",
          t("errorOccurred"),
          result.message || t("failedToSendResetEmail")
        );
      }
    } catch {
      showToast("error", t("errorOccurred"), t("unexpectedError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (fieldName: keyof FormData) => {
    // Clear field error when user starts typing
    if (errors[fieldName]) {
      clearErrors(fieldName);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white py-8 px-4 shadow sm:px-10 space-y-6">
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            {t("emailAddress")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            disabled={isLoading}
            {...register("email", {
              required: t("emailRequired"),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t("invalidEmailFormat"),
              },
            })}
            onChange={(e) => {
              setValue("email", e.target.value);
              handleInputChange("email");
            }}
            className={`${
              errors.email ? "input-error" : "input-standard"
            } mt-1 appearance-none relative w-full focus:z-10 sm:text-sm placeholder-gray-500 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder={t("emailPlaceholder")}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
            ) : null}
            {isLoading ? t("sendingResetLink") : t("sendResetLink")}
          </Button>
        </form>

        <div className="flex flex-col items-center justify-center gap-4 w-full">
          <Link
            href={`/${locale}/signin`}
            className={`text-md text-red-400 hover:text-red-600 ${
              isLoading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {t("backToSignIn")}
          </Link>

          <div className="flex items-center justify-between gap-2 w-full">
            <Link
              href={`/${locale}/signup`}
              className={`text-sm text-gray-500 hover:text-red-500 ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {t("dontHaveAccount")}
            </Link>

            <Link
              href={`/${locale}`}
              className={`text-sm text-gray-500 hover:text-red-500 ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {t("backToHome")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
