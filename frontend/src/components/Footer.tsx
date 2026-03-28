import { useTranslation } from "react-i18next";

/**
 * Public marketing + auth shell only (`PublicLayout`). Matches `Navbar` row rhythm.
 */
export default function Footer() {
  const { t } = useTranslation("nav");
  return (
    <footer role="contentinfo" className="shrink-0 border-t border-neutral-200 bg-white">
      <div className="min-h-9 w-full px-4 py-3 sm:px-6 lg:px-8">
        <span className="sr-only">{t("footer.srOnly")}</span>
      </div>
    </footer>
  );
}
