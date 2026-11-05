import { useTranslation } from "react-i18next";
import LegalDocument from "./LegalDocument";

/** Public account terms. Reachable by anonymous and signed-in visitors. */
export default function TermsPage() {
  const { t } = useTranslation("marketing");

  return (
    <LegalDocument
      title={t("legal.terms.title")}
      body={t("legal.terms.body")}
    />
  );
}
