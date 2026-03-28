import { Trans, useTranslation } from "react-i18next";
import { Link, useMatch } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Public marketing at `/business` and tenant landing at `/business/:businessId/home`.
 */
export default function BusinessHomePage() {
  const { t } = useTranslation("marketing");
  const tenantHome = useMatch({ path: "/business/:businessId/home", end: true });
  const { state } = useAuth();

  if (tenantHome) {
    const email = state.user?.type === "business" ? state.user.email : undefined;
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">
          {t("business.shell.title")}
        </h1>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>{t("business.shell.tenantCardTitle")}</CardTitle>
            <CardDescription>
              {email ? (
                <>
                  {t("business.shell.signedInPrefix")}{" "}
                  <span className="font-medium text-neutral-800">{email}</span>
                </>
              ) : (
                t("business.shell.sessionUnavailable")
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600">{t("business.shell.accountMenuHint")}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col">
      <section className="flex w-full flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full">
          <CardHeader className="items-start text-left">
            <CardTitle>{t("business.public.heroTitle")}</CardTitle>
            <CardDescription>{t("business.public.heroDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">
                  {t("business.public.features.serviceSales.title")}
                </span>
                {t("listItemSeparator")}
                {t("business.public.features.serviceSales.body")}
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">
                  {t("business.public.features.menuInventory.title")}
                </span>
                {t("listItemSeparator")}
                {t("business.public.features.menuInventory.body")}
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">
                  {t("business.public.features.purchasing.title")}
                </span>
                {t("listItemSeparator")}
                {t("business.public.features.purchasing.body")}
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">
                  {t("business.public.features.peopleSchedules.title")}
                </span>
                {t("listItemSeparator")}
                {t("business.public.features.peopleSchedules.body")}
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2 sm:col-span-2">
                <span className="font-medium text-neutral-900">
                  {t("business.public.features.reporting.title")}
                </span>
                {t("listItemSeparator")}
                {t("business.public.features.reporting.body")}
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-neutral-200 pt-6">
              <Button asChild size="sm">
                <Link to="/business/register">{t("business.public.registerCta")}</Link>
              </Button>
              <p className="self-center text-xs text-neutral-600">
                <Trans
                  ns="marketing"
                  i18nKey="business.public.registerHint"
                  components={{
                    strong: <span className="font-medium text-neutral-800" />,
                  }}
                />
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
