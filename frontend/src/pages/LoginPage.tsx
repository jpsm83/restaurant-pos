import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { login } from "@/auth/api";
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
  const { state, dispatch } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      setSubmitError(t("login.errors.sessionExpired"));
    });
    return () => cancelAnimationFrame(id);
  }, [t]);

  const isSubmitting = state.status === "loading";

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitError(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await login({
      email: data.email.trim(),
      password: data.password,
    });

    if (!result.ok || !result.data?.user) {
      const errMsg = result.ok ? t("login.errors.loginFailed") : result.error;
      dispatch({
        type: "AUTH_ERROR",
        payload: errMsg,
      });
      setSubmitError(errMsg);
      return;
    }

    localStorage.setItem("auth_had_session", "1");
    const sessionUser = result.data.user;
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    navigate(getPostLoginDestination(sessionUser), { replace: true });
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="login-password">{t("login.passwordLabel")}</Label>
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

            {(submitError || state.error) && (
              <Alert>{submitError || state.error}</Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("login.submitting") : t("login.submit")}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/signup">{t("login.createAccountLink")}</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
