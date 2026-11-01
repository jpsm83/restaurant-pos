/**
 * Horizontal venue tabs for the Business shell.
 *
 * The caller renders this only when more than one enterable venue exists. Each
 * tab is one Business context: selecting one goes to that venue's default
 * Business destination while leaving the session in Business mode.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import { Button } from "@/components/ui/button";
import { canonicalBusinessDashboardRoutePath } from "@/routes/canonicalPaths";

export function BusinessVenueTabs({
  venues,
  activeBusinessId,
}: {
  venues: readonly IAuthAccessibleVenue[];
  activeBusinessId: string;
}) {
  const { t } = useTranslation("nav");

  return (
    <nav
      aria-label={t("venueTabs.ariaLabel")}
      className="min-w-0 flex-1 overflow-x-auto"
    >
      <ul className="flex items-center gap-1">
        {venues.map((venue) => {
          const isActive = venue.businessId === activeBusinessId;
          return (
            <li key={venue.businessId}>
              <Button
                asChild
                size="sm"
                variant={isActive ? "secondary" : "ghost"}
              >
                <Link
                  to={canonicalBusinessDashboardRoutePath(venue.businessId)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {venue.tradeName}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
