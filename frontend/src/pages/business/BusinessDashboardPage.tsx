import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import BusinessAdvancedTableSection from "../../components/business/BusinessAdvancedTableSection";

/**
 * Tenant dashboard stub (`/business/:businessId/dashboard`).
 */
export default function BusinessDashboardPage() {
  const { t } = useTranslation("business");
  const { businessId } = useParams<{ businessId: string }>();
  const { state } = useAuth();

  const session = state.user;
  const email = session?.type === "business" ? session.email : undefined;

  return (
    <main className="min-h-0 flex-1 p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("dashboard.title")}</h1>
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{t("dashboard.tenantCardTitle")}</CardTitle>
          <CardDescription>
            {email ? (
              <>
                {t("dashboard.signedInPrefix")}{" "}
                <span className="font-medium text-neutral-800">{email}</span>
              </>
            ) : (
              t("dashboard.sessionUnavailable")
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">{t("dashboard.accountMenuHint")}</p>
        </CardContent>
      </Card>
      <div className="mx-auto mt-6 w-full max-w-4xl">
        <BusinessAdvancedTableSection businessId={businessId} businessEmail={email} />
      </div>
    </main>
  );
}
