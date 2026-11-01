/**
 * Customer | Business mode toggle for the authenticated chrome.
 *
 * Hidden when the signed-in User has no accessible venue. The Business side
 * opens the active venue when the URL already addresses an enterable one, and
 * otherwise the first enterable venue in list order. When venues exist but none
 * are enterable, Business stays disabled with a localized explanation and the
 * `/mode` fallback stays reachable.
 */
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuthModeNavigation } from "@/hooks/useAuthModeNavigation";
import { useErrorMessage } from "@/i18n/errorCopy";
import { findFirstEnterableVenue } from "@/lib/accessibleVenues";
import type { AuthMode } from "@/services/authMode";
import { useAccessibleVenuesQuery } from "@/services/authVenues";
import {
  businessIdFromPathname,
  canonicalBusinessDashboardRoutePath,
  canonicalCustomerDashboardPath,
  canonicalModePath,
} from "@/routes/canonicalPaths";

export default function ModeToggle({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation("mode");
  const { state } = useAuth();
  const { pathname } = useLocation();
  const resolveError = useErrorMessage();
  const isUserSession =
    state.status === "authenticated" && state.user?.type === "user";

  const venuesQuery = useAccessibleVenuesQuery({ enabled: isUserSession });
  const {
    switchModeAndNavigate,
    failure: switchFailure,
    isSwitchingMode,
  } = useAuthModeNavigation();

  const venues = venuesQuery.data ?? [];
  const firstEnterableVenue = findFirstEnterableVenue(venues);
  const currentBusinessId = businessIdFromPathname(pathname);
  const targetVenue =
    venues.find(
      (venue) =>
        venue.businessId === currentBusinessId && venue.canEnterBusiness,
    ) ?? firstEnterableVenue;

  if (!isUserSession || venues.length === 0) return null;

  const goCustomer = () => {
    void switchModeAndNavigate(
      "customer",
      canonicalCustomerDashboardPath(),
    );
  };

  const goBusiness = () => {
    if (!targetVenue) return;
    void switchModeAndNavigate(
      "business",
      canonicalBusinessDashboardRoutePath(targetVenue.businessId),
    );
  };

  return (
    <div className="relative flex flex-col items-end">
      <div
        role="group"
        aria-label={t("toggle.label")}
        className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
      >
        <Button
          type="button"
          size="sm"
          variant={mode === "customer" ? "secondary" : "ghost"}
          aria-pressed={mode === "customer"}
          disabled={isSwitchingMode}
          onClick={goCustomer}
        >
          {t("toggle.customer")}
        </Button>
        {targetVenue ? (
          <Button
            type="button"
            size="sm"
            variant={mode === "business" ? "secondary" : "ghost"}
            aria-pressed={mode === "business"}
            disabled={isSwitchingMode}
            title={t("toggle.businessHint")}
            onClick={goBusiness}
          >
            {t("toggle.business")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={mode === "business"}
            disabled
            aria-describedby="mode-toggle-unavailable"
          >
            {t("toggle.business")}
          </Button>
        )}
      </div>
      {targetVenue ? null : (
        <p
          id="mode-toggle-unavailable"
          className="mt-1 text-xs text-muted-foreground"
        >
          <Trans
            t={t}
            i18nKey="toggle.unavailable"
            components={{
              whyLink: (
                <Link
                  to={canonicalModePath()}
                  className="underline underline-offset-2 hover:text-foreground"
                />
              ),
            }}
          />
        </p>
      )}
      {switchFailure ? (
        <Alert className="absolute right-0 top-full z-dropdown mt-2 w-72">
          {resolveError(switchFailure)}
        </Alert>
      ) : null}
    </div>
  );
}
