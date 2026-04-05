import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { confirmEmail } from "@/auth/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Phase = "ready" | "loading" | "success" | "error";

export default function ConfirmEmailPage() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const [phase, setPhase] = useState<Phase>(token ? "ready" : "error");
  const [message, setMessage] = useState<string | null>(
    token ? null : t("confirmEmail.errors.missingToken"),
  );

  const runConfirm = useCallback(async () => {
    if (!token) return;
    setPhase("loading");
    setMessage(null);
    const result = await confirmEmail(token);
    if (result.ok) {
      setPhase("success");
      setMessage(result.data?.message ?? t("confirmEmail.successFallback"));
      return;
    }
    setPhase("error");
    setMessage(result.error);
  }, [token, t]);

  const missingToken = !token;

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("confirmEmail.title")}</CardTitle>
          <CardDescription>{t("confirmEmail.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phase === "ready" && !missingToken ? (
            <>
              <p className="text-sm text-neutral-700">
                {t("confirmEmail.prompt")}
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => void runConfirm()}
              >
                {t("confirmEmail.submit")}
              </Button>
            </>
          ) : null}

          {phase === "loading" ? (
            <p className="text-sm text-neutral-600">{t("confirmEmail.loading")}</p>
          ) : null}

          {phase === "success" && message ? (
            <p className="text-sm text-neutral-800">{message}</p>
          ) : null}

          {(phase === "error" || (phase === "ready" && missingToken)) &&
          message ? (
            <Alert>{message}</Alert>
          ) : null}

          {phase === "success" ? (
            <Button asChild variant="default" className="w-full">
              <Link to="/login">{t("confirmEmail.continueToSignIn")}</Link>
            </Button>
          ) : null}

          {phase !== "success" ? (
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">{t("confirmEmail.backToSignIn")}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
