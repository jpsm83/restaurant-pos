import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmEmail, refreshSession } from "@/auth/api";
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
import { canonicalDefaultDashboardPath } from "@/routes/canonicalPaths";

/** No fields — token comes from the URL; RHF owns submit / isSubmitting like other auth pages. */
type ConfirmFormValues = Record<string, never>;

export default function ConfirmEmailPage() {
  const { t } = useTranslation(["auth", "nav"]);
  const navigate = useNavigate();
  const { state, dispatch } = useAuth();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const missingToken = !token;
  const [message, setMessage] = useState<string | null>(
    missingToken ? t("confirmEmail.errors.missingToken") : null,
  );
  const [submissionFailed, setSubmissionFailed] = useState(false);

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ConfirmFormValues>({
    defaultValues: {},
  });

  const onSubmit = handleSubmit(async () => {
    if (!token) return;
    setMessage(null);
    setSubmissionFailed(false);

    const result = await confirmEmail(token);
    if (result.ok) {
      // Confirm-email does not mint a new access token; refresh reads `emailVerified` from the DB into the JWT.
      if (state.user) {
        const refreshed = await refreshSession();
        if (refreshed.ok && refreshed.data?.user) {
          dispatch({ type: "AUTH_SUCCESS", payload: refreshed.data.user });
          navigate(canonicalDefaultDashboardPath(refreshed.data.user), {
            replace: true,
          });
          return;
        }
        navigate(canonicalDefaultDashboardPath(state.user), { replace: true });
        return;
      }
      navigate("/login", { replace: true });
      return;
    }

    setMessage(result.error);
    setSubmissionFailed(true);
  });

  const showConfirmForm = token && !submissionFailed;

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
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
            <span className="text-base font-semibold text-neutral-800">
              {t("nav:brand.title")}
            </span>
          </div>
          <hr className="my-4 w-full border-0 border-t border-neutral-200" />
          <CardTitle>{t("confirmEmail.title")}</CardTitle>
          <CardDescription>{t("confirmEmail.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showConfirmForm ? (
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <p className="text-sm text-neutral-700">
                {t("confirmEmail.prompt")}
              </p>
              {isSubmitting ? (
                <p className="text-sm text-neutral-600">
                  {t("confirmEmail.loading")}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {t("confirmEmail.submit")}
              </Button>
            </form>
          ) : null}

          {(missingToken || submissionFailed) && message ? (
            <Alert>{message}</Alert>
          ) : null}

          <Button asChild variant="outline" className="w-full">
            <Link to="/login">{t("confirmEmail.backToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
