import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { getPostLoginDestination, signup } from "@/auth";
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
import { isValidPassword } from "@packages/utils/passwordPolicy.ts";

export default function SignUpPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { state, dispatch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isSubmitting = state.status === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setMessage(t("signup.errors.allRequired"));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t("signup.errors.passwordMismatch"));
      return;
    }

    if (!isValidPassword(password)) {
      setMessage(t("signup.errors.passwordPolicy"));
      return;
    }

    setMessage(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await signup({
      email: email.trim(),
      password,
    });

    if (!result.ok || !result.data?.user) {
      const errorMessage = result.ok
        ? t("signup.errors.signUpFailed")
        : result.error;
      dispatch({ type: "AUTH_ERROR", payload: errorMessage });
      setMessage(errorMessage);
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
          <CardTitle>{t("signup.title")}</CardTitle>
          <CardDescription>{t("signup.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signup-email">{t("signup.emailLabel")}</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("signup.emailPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">{t("signup.passwordLabel")}</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("signup.passwordPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password">
                {t("signup.confirmPasswordLabel")}
              </Label>
              <Input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t("signup.confirmPasswordPlaceholder")}
              />
            </div>

            {message && <Alert>{message}</Alert>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("signup.submitting") : t("signup.submit")}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">{t("signup.backToSignIn")}</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
