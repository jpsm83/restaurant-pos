/**
 * `/account/security` — the credential and account-facts surface.
 *
 * The sign-in email is read-only; the existing verified change-email flow is
 * the only editor. An unverified address shows a resend banner. Google linked
 * status and the account facts are read-only. The page never renders tokens,
 * the pending address, the Google subject, or session counters.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import type { AuthSession, UserProfile } from "@/auth/types";
import { useGoogleSignInEnabled } from "@/auth/useGoogleSignInEnabled";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useResendEmailConfirmation } from "@/hooks/useResendEmailConfirmation";
import { useFormatting } from "@/hooks/useFormatting";
import { useErrorMessage } from "@/i18n/errorCopy";
import type { ServiceRequestError } from "@/services/serviceErrors";

function dateFact(
  value: string | null,
  format: (input: string) => string,
  fallback: string,
): string {
  return value ? format(value) : fallback;
}

function booleanFact(value: boolean, yes: string, no: string): string {
  return value ? yes : no;
}

/** `/account/security` — Sign-in & security page. */
export default function CustomerSecurityPage() {
  const { t } = useTranslation("customer");
  const resolveError = useErrorMessage();
  const formatting = useFormatting();
  const { state, dispatch } = useAuth();
  const googleSignInEnabled = useGoogleSignInEnabled();
  const { resend, pending: resendPending } = useResendEmailConfirmation({
    successMessage: t("profile.emailVerify.resendSuccess"),
  });

  const sessionUser =
    state.status === "authenticated" && state.user?.type === "user"
      ? state.user
      : null;
  const userId = sessionUser?.id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState<ServiceRequestError | null>(
    null,
  );
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changeEmailMessage, setChangeEmailMessage] = useState<string | null>(
    null,
  );
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void getUserProfile(userId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadFailure(result.error);
        return;
      }
      setProfile(result.data ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const status = profile?.accountStatus ?? null;
  const email = profile?.personalDetails.email ?? sessionUser?.email ?? "";
  const notRecorded = t("security.values.notRecorded");
  const yes = t("security.values.yes");
  const no = t("security.values.no");
  const hasPassword = status?.hasPassword === true;
  const hasGoogleIdentity = status?.hasGoogleIdentity === true;
  const canReauthenticate =
    hasPassword || (hasGoogleIdentity && googleSignInEnabled);

  const facts = status
    ? [
        {
          key: "createdAt",
          label: t("security.facts.createdAt"),
          value: dateFact(
            status.createdAt,
            formatting.formatDateTime,
            notRecorded,
          ),
        },
        {
          key: "emailVerified",
          label: t("security.facts.emailVerified"),
          value: booleanFact(status.emailVerified, yes, no),
        },
        {
          key: "privacyAcceptedAt",
          label: t("security.facts.privacyAcceptedAt"),
          value: dateFact(
            status.privacyAcceptedAt,
            formatting.formatDateTime,
            notRecorded,
          ),
        },
        {
          key: "pendingEmailChange",
          label: t("security.facts.pendingEmailChange"),
          value: booleanFact(status.hasPendingEmailChange, yes, no),
        },
        {
          key: "pendingEmailRequestedAt",
          label: t("security.facts.pendingEmailRequestedAt"),
          value: dateFact(
            status.pendingEmailRequestedAt,
            formatting.formatDateTime,
            notRecorded,
          ),
        },
        {
          key: "verificationRequestedAt",
          label: t("security.facts.verificationRequestedAt"),
          value: dateFact(
            status.verificationRequestedAt,
            formatting.formatDateTime,
            notRecorded,
          ),
        },
        {
          key: "hasPassword",
          label: t("security.facts.hasPassword"),
          value: booleanFact(status.hasPassword, yes, no),
        },
        {
          key: "hasGoogleIdentity",
          label: t("security.facts.hasGoogleIdentity"),
          value: booleanFact(status.hasGoogleIdentity, yes, no),
        },
      ]
    : [];

  function handlePasswordChanged(user: AuthSession | null) {
    const nextUser =
      user ?? (sessionUser ? { ...sessionUser, hasPassword: true } : null);
    if (nextUser) dispatch({ type: "AUTH_SUCCESS", payload: nextUser });
    setProfile((current) =>
      current?.accountStatus
        ? {
            ...current,
            accountStatus: { ...current.accountStatus, hasPassword: true },
          }
        : current,
    );
    toast.success(t("security.password.success"));
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("security.title")}
      </h1>

      {loadFailure ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {resolveError(loadFailure)}
        </p>
      ) : loading && userId ? (
        <div className="mt-6 max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : status ? (
        <div className="mt-6 max-w-2xl space-y-8">
          {!status.emailVerified ? (
            <div
              className="rounded-md border border-warning/40 bg-warning/20 px-3 py-3 text-sm text-foreground"
              role="status"
            >
              <p className="font-medium">
                {t("profile.emailVerify.bannerTitle")}
              </p>
              <p className="mt-1">
                {t("profile.emailVerify.bannerDescription")}
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
                  ? t("profile.emailVerify.resendSending")
                  : t("profile.emailVerify.resendButton")}
              </Button>
            </div>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              {t("security.email.title")}
            </h2>
            <div className="space-y-2">
              <Label htmlFor="security-email">
                {t("security.email.label")}
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="security-email"
                  type="email"
                  value={email}
                  readOnly
                  aria-describedby="security-email-hint"
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChangeEmailMessage(null);
                    setChangeEmailOpen(true);
                  }}
                >
                  {t("profile.changeEmail.action")}
                </Button>
              </div>
              <p
                id="security-email-hint"
                className="text-xs text-muted-foreground"
              >
                {t("profile.fields.emailHint")}
              </p>
              <p className="text-sm text-muted-foreground" role="status">
                {status.emailVerified
                  ? t("security.email.verified")
                  : t("security.email.notVerified")}
              </p>
              {changeEmailMessage ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {changeEmailMessage}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("security.google.title")}
            </h2>
            <p className="text-sm text-foreground" role="status">
              {status.hasGoogleIdentity
                ? t("security.google.connected")
                : t("security.google.notConnected")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("security.google.description")}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("security.password.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hasPassword
                ? t("security.password.description")
                : t("security.password.setDescription")}
            </p>
            {canReauthenticate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePasswordOpen(true)}
              >
                {hasPassword
                  ? t("security.password.actionChange")
                  : t("security.password.actionSet")}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                {t("security.password.resetPrompt")}{" "}
                <Link
                  to="/forgot-password"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("security.password.resetAction")}
                </Link>
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              {t("security.facts.title")}
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.key} className="space-y-1">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="text-foreground">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : null}

      <ChangeEmailDialog
        open={changeEmailOpen}
        currentEmail={email}
        hasGoogleIdentity={status?.hasGoogleIdentity === true}
        hasPassword={status?.hasPassword === true}
        onOpenChange={setChangeEmailOpen}
        onRequested={(outcome) => {
          const message = t(
            outcome === "throttled"
              ? "profile.changeEmail.alreadySent"
              : "profile.changeEmail.success",
          );
          setChangeEmailMessage(message);
          if (outcome === "sent") toast.success(message);
        }}
      />

      <ChangePasswordDialog
        open={changePasswordOpen}
        hasGoogleIdentity={hasGoogleIdentity}
        hasPassword={hasPassword}
        onOpenChange={setChangePasswordOpen}
        onChanged={handlePasswordChanged}
      />
    </main>
  );
}
