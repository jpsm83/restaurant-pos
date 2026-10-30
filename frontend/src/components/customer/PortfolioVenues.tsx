import { useTranslation } from "react-i18next";
import type { IOwnerPortfolio } from "restaurant-pos-packages/interfaces/IOwner";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PortfolioVenues(props: { portfolio: IOwnerPortfolio }) {
  const { t } = useTranslation("customer");

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground">
        {t("venues.list.title")}
      </h2>
      {props.portfolio.companies.map((company) => (
        <section key={company._id} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {company.legalName || t("venues.list.companyFallback")}
          </h3>
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
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
