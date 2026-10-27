import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { requestPasswordReset } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { useErrorMessage } from "@/i18n/errorCopy";
import { useResendEmailConfirmation } from "@/hooks/useResendEmailConfirmation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsLoadingCard,
  BusinessProfileSettingsStaticShell,
} from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsGateReady } from "../../hooks/useBusinessProfileSettingsController";

/**
 * Mirrors {@link AddressSettingsLoadingBody}: `section` + `header` + `grid`
 * (`lg:col-span-2` main / `lg:col-span-1` side column with title + block).
 */
function CredentialsSettingsLoadingBody() {
  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <Skeleton className="h-4 w-40" aria-hidden />
        <Skeleton className="h-3 w-full max-w-lg" aria-hidden />
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Skeleton className="h-4 w-full max-w-xl" aria-hidden />
              <Skeleton className="h-3 w-full" aria-hidden />
              <Skeleton className="h-3 w-full" aria-hidden />
            </div>
            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Skeleton className="h-3 w-full max-w-md" aria-hidden />
              <Skeleton className="h-3 w-full max-w-md" aria-hidden />
              <Skeleton className="h-3 w-full max-w-md" aria-hidden />
            </div>
            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Skeleton className="h-3 w-56" aria-hidden />
            </div>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-1">
          <div className="text-sm font-semibold text-foreground" aria-hidden>
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-11 w-full max-w-full rounded-md" aria-hidden />
        </div>
      </div>
    </section>
  );
}

export default function BusinessCredentialsSettingsPage() {
  return (
    <BusinessProfileSettingsStaticShell
      loadingSlot={
        <BusinessProfileSettingsLoadingCard showFormActionsSkeleton={false}>
          <CredentialsSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <CredentialsContent ctx={ctx} />}
    </BusinessProfileSettingsStaticShell>
  );
}

function CredentialsContent({
  ctx,
}: {
  ctx: BusinessProfileSettingsGateReady;
}) {
  const { t } = useTranslation("business");
  const { state } = useAuth();
  const resolveError = useErrorMessage();
  const session = state.user;
  const [resetEmailPending, setResetEmailPending] = useState(false);
  const { resend, pending: resendPending } = useResendEmailConfirmation({
    successMessage: t("credentialsSettings.emailVerify.resendSuccess"),
  });

  const profile = ctx.profile;
  const sessionNeedsVerification =
    session?.type === "business" ? session.emailVerified !== true : false;
  const showEmailVerifyBanner =
    sessionNeedsVerification && profile.emailVerified === false;
  const signInEmail =
    session?.type === "business" ? session.email.trim() : profile.email.trim();

  async function onRequestPasswordResetEmail() {
    if (!signInEmail) {
      toast.error(t("credentialsSettings.passwordChangeEmail.missingEmail"));
      return;
    }
    setResetEmailPending(true);
    try {
      const result = await requestPasswordReset(signInEmail);
      if (result.ok) {
        toast.success(
          t("credentialsSettings.passwordChangeEmail.successFallback"),
        );
      } else {
        toast.error(resolveError(result.error));
      }
    } finally {
      setResetEmailPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {t("credentialsSettings.sectionTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("credentialsSettings.sectionDescription")}
        </p>
      </header>

      {showEmailVerifyBanner ? (
        <div
          className="rounded-md border border-warning/40 bg-warning/20 px-3 py-3 text-sm text-foreground"
          role="status"
        >
          <p className="font-medium text-foreground">
            {t("credentialsSettings.emailVerify.bannerTitle")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("credentialsSettings.emailVerify.bannerDescription")}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={resendPending}
            onClick={() => void resend()}
          >
            {resendPending
              ? t("credentialsSettings.emailVerify.resendSending")
              : t("credentialsSettings.emailVerify.resendButton")}
          </Button>
        </div>
      ) : null}

      <div className="flex settings-min-height w-full flex-col gap-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t("credentialsSettings.actionsColumnTitle")}
          </h3>
          <Button
            type="button"
            variant="destructive"
            className="px-6"
            disabled={resetEmailPending || !signInEmail}
            onClick={() => void onRequestPasswordResetEmail()}
          >
            {resetEmailPending
              ? t("credentialsSettings.passwordChangeEmail.sending")
              : t("credentialsSettings.passwordChangeEmail.button")}
          </Button>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center gap-6 text-center text-sm text-muted-foreground">
          <p className="font-bold">
            {t("credentialsSettings.passwordChangeEmail.introBody")}
          </p>
          <ul className="list-inside list-disc space-y-1.5 pl-0.5">
            <li>
              {t("credentialsSettings.passwordChangeEmail.stepCheckInbox")}
            </li>
            <li>{t("credentialsSettings.passwordChangeEmail.stepOpenLink")}</li>
            <li>
              {t("credentialsSettings.passwordChangeEmail.stepChoosePassword")}
            </li>
          </ul>
          <p className="text-destructive font-bold">
            {t("credentialsSettings.passwordChangeEmail.signInEmailLabel", {
              email: signInEmail || "—",
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
