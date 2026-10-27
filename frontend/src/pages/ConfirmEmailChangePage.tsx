import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmEmailChange, setAccessToken } from "@/auth/api";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
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

type Status = "missingToken" | "confirming" | "failure";

/**
 * Public landing page for the link emailed to a new sign-in address. Reads the
 * one-time token from the query string and consumes it on mount. A successful
 * change revokes every server session, so the local session is cleared and the
 * user is sent back to sign in with the outcome. Invalid, expired, and
 * already-used tokens all surface the same non-revealing error.
 */
export default function ConfirmEmailChangePage() {
  const { t } = useTranslation(["auth", "nav"]);
  const navigate = useNavigate();
  const { dispatch } = useAuth();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const [status, setStatus] = useState<Status>(
    token ? "confirming" : "missingToken",
  );
  const [failure, setFailure] = useState<ErrorFailure | null>(null);
  const resolveError = useErrorMessage();
  const hasConfirmed = useRef(false);

  useEffect(() => {
    if (!token || hasConfirmed.current) return;
    hasConfirmed.current = true;

    let cancelled = false;

    const confirm = async () => {
      const result = await confirmEmailChange(token);
      if (cancelled) return;

      if (result.ok) {
        // The server revoked every refresh session; clear the local one too.
        setAccessToken(null);
        localStorage.removeItem("auth_had_session");
        dispatch({ type: "AUTH_CLEAR" });
        navigate("/login", {
          replace: true,
          state: { flashMessage: t("confirmEmailChange.successMessage") },
        });
        return;
      }

      setFailure(result.error);
      setStatus("failure");
    };

    void confirm();
    return () => {
      cancelled = true;
    };
  }, [token, dispatch, navigate, t]);

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center justify-center gap-2">
            <img
              src="/imperium.png"
              alt={t("nav:brand.logoAlt")}
              className="h-10 w-12 object-contain"
              width={48}
              height={40}
            />
            <span className="text-base font-semibold text-foreground">
              {t("nav:brand.title")}
            </span>
          </div>
          <hr className="my-4 w-full border-0 border-t border-border" />
          <CardTitle>{t("confirmEmailChange.title")}</CardTitle>
          <CardDescription>{t("confirmEmailChange.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "confirming" ? (
            <p className="text-sm text-muted-foreground">
              {t("confirmEmailChange.confirming")}
            </p>
          ) : null}

          {status === "missingToken" ? (
            <Alert>{t("confirmEmailChange.errors.missingToken")}</Alert>
          ) : null}

          {status === "failure" && failure ? (
            <Alert>{resolveError(failure)}</Alert>
          ) : null}

          <Button asChild variant="outline" className="w-full">
            <Link to="/login">{t("confirmEmailChange.backToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
