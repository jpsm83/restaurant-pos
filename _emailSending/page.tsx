import { Metadata } from "next";
import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";

import { generatePrivateMetadata } from "@/lib/utils/genericMetadata";
import ErrorBoundary from "@/components/ErrorBoundary";
import ConfirmEmailUI from "@/components/server/ConfirmEmailUI";
import confirmEmailAction, {
  ConfirmEmailResult,
} from "@/app/actions/auth/confirmEmail";
import AdBanner from "@/components/adSence/AdBanner";

// Lazy load below-fold banners (they're not critical for initial render)
const ProductsBanner = dynamic(() => import("@/components/ProductsBanner"));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return generatePrivateMetadata(
    locale,
    "/confirm-email",
    "metadata.confirmEmail.title"
  );
}

export const revalidate = 3600;

export default async function ConfirmEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "confirmEmail" });

  // Handle missing token
  let result: ConfirmEmailResult;
  let initialStatus: "success" | "error" = "error";

  if (!token) {
    result = {
      success: false,
      message: t("messages.noToken"),
      error: "MISSING_TOKEN",
    };
  } else {
    try {
      // Call server action to confirm email
      result = await confirmEmailAction(token);
      initialStatus = result.success ? "success" : "error";
    } catch (error) {
      console.error("Error confirming email:", error);
      result = {
        success: false,
        message: t("messages.unexpectedError"),
        error: "CONFIRMATION_FAILED",
      };
    }
  }

  return (
    <main className="container mx-auto my-8 md:my-16">
      <ErrorBoundary context={"ConfirmEmail component"}>
        <div className="flex flex-col h-full gap-8 md:gap-16">
          {/* Products Banner */}
          <ProductsBanner size="970x90" affiliateCompany="amazon" />

          {/* AdBanner */}
          <AdBanner
            dataAdSlot="4003409246"
            uniqueId="adbanner-confirmEmail-1"
            className="hidden lg:block"
          />

          {/* Confirm Email Section */}
          <section className="space-y-6 md:space-y-12">
            <ConfirmEmailUI
              result={result}
              initialStatus={initialStatus}
              translations={{
                success: {
                  title: t("success.title"),
                  signInButton: t("success.signInButton"),
                },
                error: {
                  title: t("error.title"),
                  backToSignInButton: t("error.backToSignInButton"),
                },
                messages: {
                  noToken: t("messages.noToken"),
                  confirmationFailed: t("messages.confirmationFailed"),
                  unexpectedError: t("messages.unexpectedError"),
                },
              }}
            />
          </section>

          {/* Bottom banner - lazy loaded */}
          <ProductsBanner size="970x240" affiliateCompany="amazon" />

          {/* AdBanner */}
          <div className="flex justify-center gap-6">
            <AdBanner dataAdSlot="5459821520" uniqueId="adbanner-confirmEmail-2" />
            <AdBanner
              dataAdSlot="5459821520"
              uniqueId="adbanner-confirmEmail-3"
              className="hidden md:block"
            />
            <AdBanner
              dataAdSlot="5459821520"
              uniqueId="adbanner-confirmEmail-4"
              className="hidden md:block"
            />
            <AdBanner
              dataAdSlot="5459821520"
              uniqueId="adbanner-confirmEmail-5"
              className="hidden lg:block"
            />
          </div>
        </div>
      </ErrorBoundary>
    </main>
  );
}
