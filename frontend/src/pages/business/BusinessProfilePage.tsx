import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";

/** `/business/:businessId/profile` — placeholder until tenant profile UI ships. */
export default function BusinessProfilePage() {
  const { t } = useTranslation("business");
  const { state } = useAuth();
  const session = state.user;

  if (!session || session.type !== "business") {
    return null;
  }

  return (
    <main className="min-h-0 flex-1 p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>
      <p className="text-sm text-neutral-600">{t("profile.notBuiltYet")}</p>
    </main>
  );
}
