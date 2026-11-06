import { useTranslation } from "react-i18next";

/** `/account/orders` — placeholder until the order-history surface ships. */
export default function CustomerOrdersPage() {
  const { t } = useTranslation("customer");

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">{t("orders.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notBuiltYet")}</p>
    </main>
  );
}
