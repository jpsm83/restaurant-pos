import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBusinessProfileQuery } from "@/services/business/businessService";
import BusinessAdvancedTableSection from "../../components/business/BusinessAdvancedTableSection";

/**
 * Venue dashboard data page (`/business/:businessId/dashboard`).
 */
export default function BusinessDashboardPage() {
  const { t } = useTranslation("business");
  const { businessId } = useParams<{ businessId: string }>();
  const { state } = useAuth();

  const signedInEmail = state.user?.email;
  const profileQuery = useBusinessProfileQuery(businessId);
  const businessEmail = profileQuery.data?.email;

  return (
    <main className="min-h-0 flex-1 p-6">
      <h1 className="mb-4 text-xl font-semibold text-foreground">{t("dashboard.title")}</h1>
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{t("dashboard.tenantCardTitle")}</CardTitle>
          <CardDescription>
            {signedInEmail ? (
              <>
                {t("dashboard.signedInPrefix")}{" "}
                <span className="font-medium text-foreground">{signedInEmail}</span>
              </>
            ) : (
              t("dashboard.sessionUnavailable")
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("dashboard.accountMenuHint")}</p>
        </CardContent>
      </Card>
      <div className="mx-auto mt-6 w-full max-w-4xl">
        <BusinessAdvancedTableSection
          businessId={businessId}
          businessEmail={businessEmail}
        />
      </div>
    </main>
  );
}
