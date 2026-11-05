/**
 * The draft/incomplete-venue warning shared by the customer portfolio and the
 * Business shell.
 *
 * The profile-complete signal covers identity/contact, the address, and the
 * owning Company's tax identity, so the warning links to every surface that can
 * clear a missing part rather than assuming the profile page alone is enough.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  canonicalBusinessCompanyPath,
  canonicalBusinessProfilePath,
  canonicalBusinessSettingsAddressPath,
} from "@/routes/canonicalPaths";

export function VenueCompletionWarning({
  businessId,
  className,
}: {
  businessId: string;
  className?: string;
}) {
  const { t } = useTranslation("common");

  return (
    <Alert tone="warning" className={cn("space-y-2", className)}>
      <p>{t("venueCompletion.warning")}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link
          to={canonicalBusinessProfilePath(businessId)}
          className="font-medium underline underline-offset-4"
        >
          {t("venueCompletion.profile")}
        </Link>
        <Link
          to={canonicalBusinessSettingsAddressPath(businessId)}
          className="font-medium underline underline-offset-4"
        >
          {t("venueCompletion.address")}
        </Link>
        <Link
          to={canonicalBusinessCompanyPath(businessId)}
          className="font-medium underline underline-offset-4"
        >
          {t("venueCompletion.company")}
        </Link>
      </div>
    </Alert>
  );
}
