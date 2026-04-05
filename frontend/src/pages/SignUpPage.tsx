import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { signup } from "@/auth/api";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidPassword } from "@packages/utils/passwordPolicy.ts";
import emailRegex from "@packages/utils/emailRegex.ts";

function buildSignUpSchema(messages: {
  allRequired: string;
  invalidEmail: string;
  passwordMismatch: string;
  passwordPolicy: string;
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
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { state, dispatch } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmitting = state.status === "loading";

  const schema = useMemo(
    () =>
      buildSignUpSchema({
        allRequired: t("signup.errors.allRequired"),
        invalidEmail: t("signup.errors.invalidEmail"),
        passwordMismatch: t("signup.errors.passwordMismatch"),
        passwordPolicy: t("signup.errors.passwordPolicy"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignUpFormValues) => {
    setSubmitError(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await signup({
      email: data.email.trim(),
      password: data.password,
    });

    if (!result.ok || !result.data?.user) {
      const errorMessage = result.ok
        ? t("signup.errors.signUpFailed")
        : result.error;
      dispatch({ type: "AUTH_ERROR", payload: errorMessage });
      setSubmitError(errorMessage);
      return;
    }

    localStorage.setItem("auth_had_session", "1");
    const sessionUser = result.data.user;
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    if (sessionUser.emailVerified === false) {
      toast.info(t("signup.verifyEmailToast"));
    }
    navigate(getPostLoginDestination(sessionUser), { replace: true });
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
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

            {submitError && <Alert>{submitError}</Alert>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("signup.submitting") : t("signup.submit")}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">{t("signup.backToSignIn")}</Link>
            </Button>

            <p className="text-center text-sm text-neutral-600">
              <Link
                to="/request-email-confirmation"
                className="font-medium text-neutral-800 underline-offset-4 hover:underline"
              >
                {t("signup.resendConfirmationLink")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
