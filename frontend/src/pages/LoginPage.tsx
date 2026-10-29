import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { login } from "@/auth/api";
import { markPriorSession } from "@/auth/sessionHint";
import { GoogleAuthButton } from "@/auth/GoogleAuthButton";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function buildLoginSchema(requiredMsg: string) {
  return z.object({
    // Backend checks only for "presence" (truthy) and normalizes email on submit.
    // Keep this validation lightweight and show required errors on the correct field.
    email: z.string().min(1, requiredMsg),
    password: z.string().min(1, requiredMsg),
  });
}

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>;

export default function LoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useAuth();
  const [submitFailure, setSubmitFailure] = useState<ErrorFailure | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const resolveError = useErrorMessage();

  const flashMessage =
    (location.state as { flashMessage?: string } | null)?.flashMessage ?? null;
  const returnTo = getReturnToParam(location.search);

  const schema = useMemo(
    () => buildLoginSchema(t("login.errors.required")),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const shouldShowExpiredNotice =
      sessionStorage.getItem("auth_session_expired_notice") === "1";
    if (!shouldShowExpiredNotice) return;
    sessionStorage.removeItem("auth_session_expired_notice");
    const id = requestAnimationFrame(() => {
      setSessionExpired(true);
    });
    return () => cancelAnimationFrame(id);
  }, [t]);

  const isSubmitting = state.status === "loading";

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitFailure(null);
    setSessionExpired(false);
    dispatch({ type: "AUTH_LOADING" });

    const result = await login({
      email: data.email.trim(),
      password: data.password,
    });

    if (!result.ok || !result.data?.user) {
      const failure: ErrorFailure = result.ok
        ? { code: "signIn.internal" }
        : result.error;
      dispatch({ type: "AUTH_ERROR", payload: failure.code });
      setSubmitFailure(failure);
      return;
    }

    markPriorSession();
    const sessionUser = result.data.user;
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    if (sessionUser.emailVerified === false) {
      toast.info(t("login.verifyEmailToast"));
    }
    navigate(getPostLoginDestination(sessionUser, returnTo), { replace: true });
  };

  const stateFailure: ErrorFailure | null = state.error
    ? { code: state.error }
    : null;
  const failure = submitFailure ?? stateFailure;
  const alertMessage = sessionExpired
    ? t("login.errors.sessionExpired")
    : failure
      ? resolveError(failure)
      : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flashMessage ? (
            <Alert tone="success">{flashMessage}</Alert>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          >
            <div className="space-y-2">
              <Label htmlFor="login-email">{t("login.emailLabel")}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={t("login.emailPlaceholder")}
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <Label htmlFor="login-password">{t("login.passwordLabel")}</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t("login.forgotPasswordLink")}
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder={t("login.passwordPlaceholder")}
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
            </div>

            {alertMessage ? <Alert>{alertMessage}</Alert> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("login.submitting") : t("login.submit")}
            </Button>

            <GoogleAuthButton onFailure={setSubmitFailure} />

            <Button asChild variant="outline" className="w-full">
              <Link to="/signup">{t("login.createAccountLink")}</Link>
            </Button>

          </form>
        </CardContent>
      </Card>
    </main>
  );
}
