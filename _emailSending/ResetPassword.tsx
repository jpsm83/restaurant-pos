"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useSession, signOut } from "next-auth/react";
import resetPassword from "@/app/actions/auth/resetPassword";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import passwordValidation from "@/lib/utils/passwordValidation";
import { showToast } from "@/components/Toasts";

interface FormData {
  newPassword: string;
  confirmPassword: string;
}

interface ResetPasswordProps {
  locale: string;
  token?: string;
}

export default function ResetPassword({
  locale,
  token: tokenProp,
}: ResetPasswordProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState(tokenProp || "");
  const t = useTranslations("ResetPassword");

  const { status } = useSession();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    clearErrors,
    watch,
  } = useForm<FormData>({
    mode: "onChange",
  });

  const newPassword = watch("newPassword");

  // Update token if prop changes
  useEffect(() => {
    if (tokenProp) {
      setToken(tokenProp);
    }
  }, [tokenProp]);

  const onSubmit = async (data: FormData) => {
    if (!token) {
      showToast("error", t("errorOccurred"), t("resetTokenMissing"));
      return;
    }

    if (!data.newPassword || !data.confirmPassword) {
      showToast("error", t("errorOccurred"), t("bothPasswordsRequired"));
      return;
    }

    if (data.newPassword !== data.confirmPassword) {
      showToast("error", t("errorOccurred"), t("passwordsDoNotMatch"));
      return;
    }

    if (data.newPassword.length < 6) {
      showToast("error", t("errorOccurred"), t("passwordTooShort"));
      return;
    }

    setIsLoading(true);

    try {
      // Use server action instead of fetch
      const result = await resetPassword(token, data.newPassword);

      if (result.success) {
        showToast(
          "success",
          t("passwordResetSuccess"),
          result.message || t("redirectingToSignIn")
        );
        // Clear the form on success
        setValue("newPassword", "");
        setValue("confirmPassword", "");

        // Sign out the user if they're authenticated (for profile password change flow)
        // Only check status after component is mounted to prevent hydration mismatch
        if (status === "authenticated") {
          try {
            await signOut({ redirect: false });
          } catch (logoutError) {
            console.error("Logout error:", logoutError);
            // Continue even if logout fails
          }
        }

        // Redirect to signin page after a short delay
        setTimeout(() => {
          router.push(`/${locale}/signin`);
        }, 2000);
      } else {
        showToast(
          "error",
          t("errorOccurred"),
          result.message || t("failedToResetPassword")
        );
      }
    } catch (error) {
      console.error("Reset password error:", error);
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

  if (!token) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <p className="text-sm text-gray-600 mb-4">
            {t("resetLinkInvalidOrExpired")}
          </p>
          <Link
            href={`/${locale}/forgot-password`}
            className="font-medium text-red-600 hover:text-red-500"
          >
            {t("requestNewPasswordReset")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white py-8 px-4 shadow sm:px-10 space-y-6">
        <p className="text-md text-center text-red-500 font-bold">
          {t("passwordRequirements")}
        </p>
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <label
              htmlFor="newPassword"
              className="text-sm font-medium text-gray-700"
            >
              {t("newPassword")}
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              {...register("newPassword", {
                required: t("newPasswordRequired"),
                minLength: {
                  value: 6,
                  message: t("passwordTooShort"),
                },
                validate: (value: string) => {
                  if (!passwordValidation(value)) {
                    return t("passwordValidationError");
                  }
                  return true;
                },
              })}
              onChange={(e) => {
                setValue("newPassword", e.target.value);
                handleInputChange("newPassword");
              }}
              className={`${
                errors.newPassword ? "input-error" : "input-standard"
              } mt-1 appearance-none relative w-full focus:z-10 sm:text-sm placeholder-gray-500 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed`}
              placeholder={t("enterNewPassword")}
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.newPassword.message}
              </p>
            )}

            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-gray-700"
            >
              {t("confirmNewPassword")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              {...register("confirmPassword", {
                required: t("confirmPasswordRequired"),
                validate: (value) => {
                  if (value !== newPassword) {
                    return t("passwordsDoNotMatch");
                  }
                  return true;
                },
              })}
              onChange={(e) => {
                setValue("confirmPassword", e.target.value);
                handleInputChange("confirmPassword");
              }}
              className={`${
                errors.confirmPassword ? "input-error" : "input-standard"
              } mt-1 appearance-none relative w-full focus:z-10 sm:text-sm placeholder-gray-500 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed`}
              placeholder={t("confirmNewPassword")}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
            ) : null}
            {isLoading ? t("resettingPassword") : t("resetPassword")}
          </Button>
        </form>

        <div className="flex flex-col items-center justify-center gap-4 w-full">
          <Link
            href={`/${locale}/forgot-password`}
            className={`text-md text-red-400 hover:text-red-600 ${
              isLoading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {t("requestNewPasswordReset")}
          </Link>

          <div className="flex items-center justify-between gap-2 w-full">
            <Link
              href={`/${locale}/signin`}
              className={`text-sm text-gray-500 hover:text-red-500 ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {t("backToSignIn")}
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
