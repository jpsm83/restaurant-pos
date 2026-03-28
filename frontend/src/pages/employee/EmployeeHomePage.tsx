import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

/** `/:userId/employee/home` — staff home; top bar: `Navbar` in `EmployeeLayout`. */
export default function EmployeeHomePage() {
  const { t } = useTranslation("employee");
  const { userId } = useParams();

  return (
    <main className="min-h-0 flex-1 p-6">
      <h1 className="text-xl font-semibold text-neutral-900">{t("home.title")}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        <Trans
          ns="employee"
          i18nKey="home.subline"
          values={{ userId: userId ?? "" }}
          components={{ mono: <span className="font-mono" /> }}
        />
      </p>
    </main>
  );
}
