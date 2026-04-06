import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { requestPasswordReset } from "@/auth/api";
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
import emailRegex from "@packages/utils/emailRegex.ts";

function buildSchema(messages: { required: string; invalidEmail: string }) {
  return z
    .string()
    .trim()
    .min(1, messages.required)
    .regex(emailRegex, messages.invalidEmail);
}

type FormValues = { email: string };

export default function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "nav"]);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailSchema = useMemo(
    () =>
      buildSchema({
        required: t("forgotPassword.errors.required"),
        invalidEmail: t("forgotPassword.errors.invalidEmail"),
      }),
    [t],
  );

  const schema = useMemo(
    () =>
      z.object({
        email: emailSchema,
      }),
    [emailSchema],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(data.email.trim());
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      navigate("/login", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

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
          <CardTitle>{t("forgotPassword.title")}</CardTitle>
          <CardDescription>{t("forgotPassword.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          >
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{t("forgotPassword.emailLabel")}</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={t("forgotPassword.emailPlaceholder")}
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>

            {submitError ? <Alert>{submitError}</Alert> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? t("forgotPassword.submitting")
                : t("forgotPassword.submit")}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">{t("forgotPassword.backToSignIn")}</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
