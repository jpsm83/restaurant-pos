/**
 * Owner chrome for a venue the signed-in User owns.
 *
 * This slice ships the destinations whose pages already exist: **Add venue**
 * (the shared venue-registration form in a sheet) and **Company**. Plan and
 * Billing stay out until their owning rows add destinations, so no dead links
 * are rendered here.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  AddVenueForm,
  type ExistingCompany,
} from "@/components/customer/AddVenueForm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { canonicalBusinessCompanyPath } from "@/routes/canonicalPaths";

export function BusinessOwnerChrome({
  businessId,
  companies,
  defaultCountry,
}: {
  businessId: string;
  companies?: readonly ExistingCompany[];
  defaultCountry: string | null;
}) {
  const { t } = useTranslation("nav");
  const [isAddingVenue, setIsAddingVenue] = useState(false);

  return (
    <div className="ml-auto flex items-center gap-2">
      <Sheet open={isAddingVenue} onOpenChange={setIsAddingVenue}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus aria-hidden />
            {t("owner.addVenue")}
          </Button>
        </SheetTrigger>
        <SheetContent
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
          aria-describedby="owner-add-venue-description"
        >
          <SheetHeader>
            <SheetTitle>{t("owner.addVenueTitle")}</SheetTitle>
            <SheetDescription id="owner-add-venue-description">
              {t("owner.addVenueDescription")}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <AddVenueForm
              companies={companies}
              defaultCountry={defaultCountry}
              onCancel={() => setIsAddingVenue(false)}
              onCreated={() => setIsAddingVenue(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      <Button asChild variant="outline" size="sm">
        <Link to={canonicalBusinessCompanyPath(businessId)}>
          <Building2 aria-hidden />
          {t("owner.company")}
        </Link>
      </Button>
    </div>
  );
}
