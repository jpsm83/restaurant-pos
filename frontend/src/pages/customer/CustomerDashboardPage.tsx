import { useTranslation } from "react-i18next";

/** `/:userId/customer/dashboard` — placeholder customer dashboard shell. */
export default function CustomerDashboardPage() {
  const { t } = useTranslation("customer");

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-neutral-900">{t("dashboard.title")}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t("notBuiltYet")}</p>
    </main>
  );
}
