import { useTranslation } from "react-i18next";

/** `/employee/dashboard` — placeholder employee dashboard shell. */
export default function EmployeeDashboardPage() {
  const { t } = useTranslation("employee");

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">{t("dashboard.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notBuiltYet")}</p>
    </main>
  );
}
