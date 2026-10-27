import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/store/AuthContext";
import { Button } from "@/components/ui/button";
import { useResendEmailConfirmation } from "@/hooks/useResendEmailConfirmation";

/** `/:userId/customer/profile` — verification CTA when sign-in email is not verified. */
export default function CustomerProfilePage() {
  const { t } = useTranslation("customer");
  const { state } = useAuth();
  const { resend, pending: resendPending } = useResendEmailConfirmation({
    successMessage: t("profile.emailVerify.resendSuccess"),
  });
  const user = state.user;
  const needsVerification =
    state.status === "authenticated" &&
    user?.type === "user" &&
    user.emailVerified === false;

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">{t("profile.title")}</h1>

      {needsVerification ? (
        <div
          className="mt-4 max-w-lg rounded-md border border-warning/40 bg-warning/20 px-3 py-3 text-sm text-foreground"
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
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("notBuiltYet")}</p>
      )}
    </main>
  );
}
