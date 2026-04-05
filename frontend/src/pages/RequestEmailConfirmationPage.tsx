import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { z } from "zod";
import { requestEmailConfirmation } from "@/auth/api";
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

function buildEmailFieldSchema(messages: { required: string; invalidEmail: string }) {
  return z
    .string()
    .trim()
    .min(1, messages.required)
    .regex(emailRegex, messages.invalidEmail);
}

type FormValues = { email: string };

export default function RequestEmailConfirmationPage() {
  const { t } = useTranslation("auth");
  const [done, setDone] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailSchema = useMemo(
    () =>
      buildEmailFieldSchema({
        required: t("requestEmailConfirmation.errors.required"),
        invalidEmail: t("requestEmailConfirmation.errors.invalidEmail"),
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
      const result = await requestEmailConfirmation(data.email.trim());
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setSuccessMessage(
        result.data?.message ?? t("requestEmailConfirmation.successMessage"),
      );
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("requestEmailConfirmation.title")}</CardTitle>
          <CardDescription>
            {t("requestEmailConfirmation.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-700">
                {successMessage ?? t("requestEmailConfirmation.successMessage")}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">{t("requestEmailConfirmation.backToSignIn")}</Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              <div className="space-y-2">
                <Label htmlFor="req-confirm-email">
                  {t("requestEmailConfirmation.emailLabel")}
                </Label>
                <Input
                  id="req-confirm-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("requestEmailConfirmation.emailPlaceholder")}
                  aria-invalid={errors.email ? true : undefined}
                  {...register("email")}
                />
                <FieldError message={errors.email?.message} />
              </div>

              {submitError ? <Alert>{submitError}</Alert> : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? t("requestEmailConfirmation.submitting")
                  : t("requestEmailConfirmation.submit")}
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link to="/login">{t("requestEmailConfirmation.backToSignIn")}</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
