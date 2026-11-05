import { useTranslation } from "react-i18next";
import LegalDocument from "./LegalDocument";

/** Public privacy notice. Reachable by anonymous and signed-in visitors. */
export default function PrivacyNoticePage() {
  const { t } = useTranslation("marketing");

  return (
    <LegalDocument
      title={t("legal.privacy.title")}
      body={t("legal.privacy.body")}
    />
  );
}
