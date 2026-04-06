import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { resetPassword } from "@/auth/api";
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

function buildResetSchema(messages: {
  allRequired: string;
  passwordMismatch: string;
  passwordPolicy: string;
}) {
  return z
    .object({
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

type FormValues = z.infer<ReturnType<typeof buildResetSchema>>;

export default function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "nav"]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      buildResetSchema({
        allRequired: t("resetPassword.errors.allRequired"),
        passwordMismatch: t("resetPassword.errors.passwordMismatch"),
        passwordPolicy: t("resetPassword.errors.passwordPolicy"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: FormValues) => {
    if (!token) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await resetPassword(token, data.password);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      navigate("/login", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const missingToken = !token;

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
          <CardTitle>{t("resetPassword.title")}</CardTitle>
          <CardDescription>{t("resetPassword.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missingToken ? (
            <Alert>{t("resetPassword.errors.missingToken")}</Alert>
          ) : null}

          {!missingToken ? (
            <form
              className="space-y-4"
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              <div className="space-y-2">
                <Label htmlFor="reset-password">
                  {t("resetPassword.passwordLabel")}
                </Label>
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("resetPassword.passwordPlaceholder")}
                  aria-invalid={errors.password ? true : undefined}
                  {...register("password")}
                />
                <FieldError message={errors.password?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">
                  {t("resetPassword.confirmPasswordLabel")}
                </Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                  aria-invalid={errors.confirmPassword ? true : undefined}
                  {...register("confirmPassword")}
                />
                <FieldError message={errors.confirmPassword?.message} />
              </div>

              {submitError ? <Alert>{submitError}</Alert> : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? t("resetPassword.submitting")
                  : t("resetPassword.submit")}
              </Button>
            </form>
          ) : null}

          <Button asChild variant="outline" className="w-full">
            <Link to="/login">{t("resetPassword.backToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
