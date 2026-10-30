import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { IOwnerPortfolio } from "restaurant-pos-packages/interfaces/IOwner";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canonicalBusinessProfilePath } from "@/routes/canonicalPaths";
import { companyDisplayName } from "./companyDisplayName";

type PortfolioVenuesProps = {
  portfolio: IOwnerPortfolio;
  onOpenBusiness: (businessId: string) => void;
  isOpeningBusiness: boolean;
};

export function PortfolioVenues({
  portfolio,
  onOpenBusiness,
  isOpeningBusiness,
}: PortfolioVenuesProps) {
  const { t } = useTranslation("customer");

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground">
        {t("venues.list.title")}
      </h2>
      {portfolio.companies.map((company, index) => (
        <section key={company._id} className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {companyDisplayName(
                company,
                t("venues.companyFallback", { index: index + 1 }),
              )}
            </h3>
            {company.legalName && company.taxNumber ? (
              <p className="text-xs text-muted-foreground">
                {t("venues.list.companyTax", {
                  taxNumber: company.taxNumber,
                })}
              </p>
            ) : null}
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {company.businesses.map((business) => (
              <li key={business._id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {business.tradeName}
                    </CardTitle>
                    <CardDescription>
                      {t("venues.list.venueMeta", {
                        country:
                          business.address?.country ?? company.country,
                        currency: business.currencyTrade,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {business.profileComplete ? null : (
                      <Alert tone="warning" className="space-y-1">
                        <p>{t("venues.list.incompleteWarning")}</p>
                        <Link
                          to={canonicalBusinessProfilePath(business._id)}
                          className="font-medium underline underline-offset-4"
                        >
                          {t("venues.list.completeProfile")}
                        </Link>
                      </Alert>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isOpeningBusiness}
                      aria-busy={isOpeningBusiness || undefined}
                      onClick={() => onOpenBusiness(business._id)}
                    >
                      {t("venues.list.openBusiness")}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
