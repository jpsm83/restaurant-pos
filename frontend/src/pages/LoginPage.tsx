import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { getPostLoginDestination, login } from "@/auth";
import { useAuth } from "@/auth/store/AuthContext";
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

export default function LoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { state, dispatch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setSubmitError(t("login.errors.required"));
      return;
    }

    setSubmitError(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await login({
      email: email.trim(),
      password,
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
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("login.emailPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("login.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("login.passwordPlaceholder")}
              />
            </div>

            {(submitError || state.error) && <Alert>{submitError || state.error}</Alert>}

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
