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
import { useOwnerPortfolioQuery } from "@/services/portfolio/portfolioService";
import { ServiceRequestError } from "@/services/serviceErrors";

function hasVenues(portfolio: IOwnerPortfolio | undefined): boolean {
  return Boolean(
    portfolio?.companies.some((company) => company.businesses.length > 0),
  );
}

/** `/:userId/customer/dashboard` — the Owner's portfolio and first Add your venue. */
export default function CustomerDashboardPage() {
  const { t } = useTranslation("customer");
  const { state } = useAuth();
  const userId = state.user?.id;
  const portfolioQuery = useOwnerPortfolioQuery(userId);
  const resolveError = useErrorMessage();
  const [isAdding, setIsAdding] = useState(false);

  const portfolio = portfolioQuery.data;
  const showEmptyState = !hasVenues(portfolio);
  const queryFailure =
    portfolioQuery.error instanceof ServiceRequestError
      ? portfolioQuery.error
      : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("dashboard.title")}
      </h1>

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
                defaultCountry={portfolio?.country}
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
          <PortfolioVenues portfolio={portfolio} />
        </div>
      ) : null}
    </main>
  );
}
