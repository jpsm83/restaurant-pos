import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { signup } from "@/auth/api";
import { markPriorSession } from "@/auth/sessionHint";
import { GoogleAuthButton } from "@/auth/GoogleAuthButton";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import { isSupportedLanguage } from "@/i18n/config";
import {
  getPostLoginDestination,
  getReturnToParam,
} from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { FieldError } from "@/components/FieldError";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidPassword } from "restaurant-pos-packages/utils/passwordPolicy";
import emailRegex from "restaurant-pos-packages/utils/emailRegex";

function buildSignUpSchema(messages: {
  allRequired: string;
  invalidEmail: string;
  passwordMismatch: string;
  passwordPolicy: string;
  privacyRequired: string;
}) {
  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1, messages.allRequired)
        .regex(emailRegex, messages.invalidEmail),
      password: z.string().min(1, messages.allRequired),
      confirmPassword: z.string().min(1, messages.allRequired),
      privacyAccepted: z
        .boolean()
        .refine((value) => value === true, messages.privacyRequired),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordMismatch,
      path: ["confirmPassword"],
    })
    .refine(
      (data) =>
        data.password !== data.confirmPassword ||
        isValidPassword(data.password),
      {
        message: messages.passwordPolicy,
        path: ["password"],
      },
    );
}

type SignUpFormValues = z.infer<ReturnType<typeof buildSignUpSchema>>;

export default function SignUpPage() {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useAuth();
  const returnTo = getReturnToParam(location.search);
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "")
    .split("-")[0]
    .toLowerCase();
  const languagePreference = isSupportedLanguage(language)
    ? language
    : undefined;
  const [submitFailure, setSubmitFailure] = useState<ErrorFailure | null>(null);
  const resolveError = useErrorMessage();
  const isSubmitting = state.status === "loading";

  const schema = useMemo(
    () =>
      buildSignUpSchema({
        allRequired: t("signup.errors.allRequired"),
        invalidEmail: t("signup.errors.invalidEmail"),
        passwordMismatch: t("signup.errors.passwordMismatch"),
        passwordPolicy: t("signup.errors.passwordPolicy"),
        privacyRequired: t("signup.errors.privacyRequired"),
      }),
    [t],
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      privacyAccepted: false,
    },
  });

  const onSubmit = async (data: SignUpFormValues) => {
    setSubmitFailure(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await signup({
      email: data.email.trim(),
      password: data.password,
      privacyAccepted: data.privacyAccepted,
      ...(languagePreference ? { languagePreference } : {}),
    });

    if (!result.ok) {
      dispatch({ type: "AUTH_ERROR", payload: result.error.code });
      setSubmitFailure(result.error);
      return;
    }

    if (!result.data?.user) {
      dispatch({ type: "AUTH_CLEAR" });
      toast.info(
        result.data?.reactivationRequired
          ? t("login.reactivationRequired")
          : t("requestEmailConfirmation.successMessage"),
      );
      return;
    }

    markPriorSession();
    const sessionUser = result.data.user;
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    if (sessionUser.emailVerified === false) {
      toast.info(t("signup.verifyEmailToast"));
    }
    navigate(getPostLoginDestination(returnTo), { replace: true });
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("signup.title")}</CardTitle>
          <CardDescription>{t("signup.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          >
            <div className="space-y-2">
              <Label htmlFor="signup-email">{t("signup.emailLabel")}</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder={t("signup.emailPlaceholder")}
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">{t("signup.passwordLabel")}</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder={t("signup.passwordPlaceholder")}
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password">
                {t("signup.confirmPasswordLabel")}
              </Label>
              <Input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder={t("signup.confirmPasswordPlaceholder")}
                aria-invalid={errors.confirmPassword ? true : undefined}
                {...register("confirmPassword")}
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <Controller
              control={control}
              name="privacyAccepted"
              render={({ field }) => (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="signup-privacy-accepted"
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      onBlur={field.onBlur}
                      ref={field.ref}
                      aria-labelledby="signup-privacy-accepted-label"
                      aria-invalid={
                        errors.privacyAccepted ? true : undefined
                      }
                    />
                    <Label
                      id="signup-privacy-accepted-label"
                      htmlFor="signup-privacy-accepted"
                      className="text-sm leading-snug font-normal"
                    >
                      {t("signup.privacyAcceptanceLabel")}
                    </Label>
                  </div>
                  <FieldError message={errors.privacyAccepted?.message} />
                </div>
              )}
            />

            {submitFailure ? (
              <Alert>{resolveError(submitFailure)}</Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("signup.submitting") : t("signup.submit")}
            </Button>

            <GoogleAuthButton onFailure={setSubmitFailure} />

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">{t("signup.backToSignIn")}</Link>
            </Button>

          </form>
        </CardContent>
      </Card>
    </main>
  );
}
