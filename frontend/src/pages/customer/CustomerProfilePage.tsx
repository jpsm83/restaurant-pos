import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { resendEmailConfirmation } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { Button } from "@/components/ui/button";

/** `/:userId/customer/profile` — verification CTA when sign-in email is not verified. */
export default function CustomerProfilePage() {
  const { t } = useTranslation("customer");
  const { state } = useAuth();
  const [resendPending, setResendPending] = useState(false);
  const user = state.user;
  const needsVerification =
    state.status === "authenticated" &&
    user?.type === "user" &&
    user.emailVerified === false;

  async function onResendConfirmation() {
    setResendPending(true);
    try {
      const result = await resendEmailConfirmation();
      if (result.ok) {
        toast.success(
          result.data?.message ?? t("profile.emailVerify.resendSuccessFallback"),
        );
      } else {
        toast.error(result.error);
      }
    } finally {
      setResendPending(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>

      {needsVerification ? (
        <div
          className="mt-4 max-w-lg rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-neutral-800"
          role="status"
        >
          <p className="font-medium text-neutral-900">
            {t("profile.emailVerify.bannerTitle")}
          </p>
          <p className="mt-1 text-neutral-700">
            {t("profile.emailVerify.bannerDescription")}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={resendPending}
            onClick={() => void onResendConfirmation()}
          >
            {resendPending
              ? t("profile.emailVerify.resendSending")
              : t("profile.emailVerify.resendButton")}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">{t("notBuiltYet")}</p>
      )}
    </main>
  );
}
