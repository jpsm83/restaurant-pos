import { useTranslation } from "react-i18next";
import { useMatch } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Public marketing at `/` and logged-in customer shell home at `/:userId/customer/home`.
 */
export default function CustomerHomePage() {
  const { t: tMarketing } = useTranslation("marketing");
  const { t: tCustomer } = useTranslation("customer");
  const shellHome = useMatch({ path: "/:userId/customer/home", end: true });
  const { state } = useAuth();

  if (shellHome) {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="text-xl font-semibold text-neutral-900">{tCustomer("shell.title")}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {tCustomer("shell.signedInLine", {
            email: state.user?.email ?? tCustomer("shell.emailFallback"),
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col">
      <section className="flex w-full flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full">
          <CardHeader className="items-start text-left">
            <CardTitle>{tMarketing("customer.public.heroTitle")}</CardTitle>
            <CardDescription>{tMarketing("customer.public.heroDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[120px_1fr]">
            <img
              src="/imperium.png"
              alt={tMarketing("customer.public.logoAlt")}
              className="h-28 w-28 rounded-xl border border-neutral-200 bg-white p-2 object-contain"
            />
            <div className="space-y-4 text-sm text-neutral-700">
              <p>
                <span className="font-medium text-neutral-900">
                  {tMarketing("customer.public.features.reservations.title")}
                </span>
                {tMarketing("listItemSeparator")}
                {tMarketing("customer.public.features.reservations.body")}
              </p>
              <p>
                <span className="font-medium text-neutral-900">
                  {tMarketing("customer.public.features.selfOrdering.title")}
                </span>
                {tMarketing("listItemSeparator")}
                {tMarketing("customer.public.features.selfOrdering.body")}
              </p>
              <p>
                <span className="font-medium text-neutral-900">
                  {tMarketing("customer.public.features.account.title")}
                </span>
                {tMarketing("listItemSeparator")}
                {tMarketing("customer.public.features.account.body")}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
