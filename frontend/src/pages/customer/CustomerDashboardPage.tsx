import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { IOwnerPortfolio } from "restaurant-pos-packages/interfaces/IOwner";
import { useAuth } from "@/auth/store/AuthContext";
import { AddVenueForm } from "@/components/customer/AddVenueForm";
import { PortfolioVenues } from "@/components/customer/PortfolioVenues";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/i18n/errorCopy";
import { useAuthModeNavigation } from "@/hooks/useAuthModeNavigation";
import {
  hasOwnedBusiness,
  useOwnerPortfolioQuery,
} from "@/services/portfolio/portfolioService";
import { ServiceRequestError } from "@/services/serviceErrors";
import { canonicalBusinessDashboardRoutePath } from "@/routes/canonicalPaths";

function hasVenues(portfolio: IOwnerPortfolio | undefined): boolean {
  return Boolean(
    portfolio?.companies.some((company) => company.businesses.length > 0),
  );
}

/** `/dashboard` — the Owner's portfolio and add-venue entry. */
export default function CustomerDashboardPage() {
  const { t } = useTranslation("customer");
  const { state } = useAuth();
  const userId = state.user?.id;
  const portfolioQuery = useOwnerPortfolioQuery(userId);
  const resolveError = useErrorMessage();
  const [isAdding, setIsAdding] = useState(false);
  const { switchModeAndNavigate, failure: switchFailure, isSwitchingMode } =
    useAuthModeNavigation();

  const portfolio = portfolioQuery.data;
  const showEmptyState = !hasVenues(portfolio);
  const queryFailure =
    portfolioQuery.error instanceof ServiceRequestError
      ? portfolioQuery.error
      : null;

  const openBusiness = (businessId: string) => {
    if (!hasOwnedBusiness(portfolio, businessId)) return;
    void switchModeAndNavigate(
      "business",
      canonicalBusinessDashboardRoutePath(businessId),
    );
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("dashboard.title")}
      </h1>

      {switchFailure ? (
        <div className="mt-6 max-w-2xl">
          <Alert>{resolveError(switchFailure)}</Alert>
        </div>
      ) : null}

      {portfolioQuery.isLoading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-28 w-full max-w-2xl" />
        </div>
      ) : portfolioQuery.isError ? (
        <div className="mt-6 max-w-2xl space-y-3">
          <Alert>
            {resolveError(
              queryFailure ?? { code: "portfolioFetch.transport" },
            )}
          </Alert>
          <Button variant="outline" onClick={() => void portfolioQuery.refetch()}>
            {t("venues.list.retry")}
          </Button>
        </div>
      ) : showEmptyState ? (
        <Card className="mt-6 w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{t("venues.empty.title")}</CardTitle>
            <CardDescription>{t("venues.empty.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdding ? (
              <AddVenueForm
                defaultCountry={portfolio?.country ?? null}
                onCancel={() => setIsAdding(false)}
                onCreated={() => setIsAdding(false)}
              />
            ) : (
              <Button onClick={() => setIsAdding(true)}>
                {t("venues.empty.addAction")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : portfolio ? (
        <div className="mt-6 space-y-4">
          {isAdding ? (
            <Card>
              <CardContent className="pt-6">
                <AddVenueForm
                  companies={portfolio.companies}
                  defaultCountry={portfolio.country}
                  onCancel={() => setIsAdding(false)}
                  onCreated={() => setIsAdding(false)}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex justify-end">
              <Button onClick={() => setIsAdding(true)}>
                {t("venues.list.addAction")}
              </Button>
            </div>
          )}
          <PortfolioVenues
            portfolio={portfolio}
            onOpenBusiness={openBusiness}
            isOpeningBusiness={isSwitchingMode}
          />
        </div>
      ) : null}
    </main>
  );
}
