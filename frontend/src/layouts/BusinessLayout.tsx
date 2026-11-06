/**
 * ## `BusinessLayout` (`src/layouts`)
 * **Parent route:** `path="/business/:businessId"` in `appRoutes.tsx`, wrapped by
 * **`BusinessRouteShell`** (authenticated User session) before this layout renders.
 *
 * ## Flow
 * **`SidebarProvider`** wraps routed content in **`main.tsx`**. This layout adds **Sidebar** +
 * **main column** (same flex role as shadcn `SidebarInset`, but a **`div`** so child pages may use `<main>`); **`<Outlet />`** (in **`Suspense`**) renders tenant pages in the main
 * column (`dashboard`, `people`, `company`, `settings/profile`, `settings/address`,
 * `settings/open-hours`, `settings/delivery`, `settings/metrics`). Business has no
 * Me group: self-only destinations live on the global account surface (ADR-0018).
 * When the accessible-venue list has more than one enterable venue the layout renders
 * horizontal **venue tabs** above the routed content; owned venues also carry **Owner chrome**
 * (**Add venue** and **Company**). The sidebar footer carries the minimal
 * return-to-customer action.
 *
 * Folder overview: `PublicLayout`, `CustomerLayout`, `CustomerAccountLayout`, and this layout —
 * all wired from `appRoutes.tsx`.
 */
import { Suspense } from "react";
import { Outlet, useParams } from "react-router-dom";
import { AppPendingShell } from "@/components/AppPendingShell";
import ActorSidebar from "@/components/ActorSidebar";
import { BusinessOwnerChrome } from "@/components/business/BusinessOwnerChrome";
import { BusinessVenueTabs } from "@/components/business/BusinessVenueTabs";
import { VenueCompletionWarning } from "@/components/business/VenueCompletionWarning";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  LayoutDashboard,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { useAuthModeNavigation } from "@/hooks/useAuthModeNavigation";
import { useErrorMessage } from "@/i18n/errorCopy";
import { useAccessibleVenuesQuery } from "@/services/authVenues";
import {
  hasOwnedBusiness,
  useOwnerPortfolioQuery,
} from "@/services/portfolio/portfolioService";
import {
  canAdministerVenue,
  canManageVenue,
  useBusinessAccessSnapshotQuery,
} from "@/services/employees/employeesService";
import {
  canonicalBusinessDashboardRoutePath,
  canonicalBusinessPeoplePath,
  canonicalBusinessSettingsDeliveryPath,
  canonicalBusinessSettingsMetricsPath,
  canonicalBusinessSettingsOpenHoursPath,
  canonicalCustomerDashboardPath,
} from "@/routes/canonicalPaths";

export default function BusinessLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const { businessId } = useParams<{ businessId: string }>();
  const resolveError = useErrorMessage();
  const {
    switchModeAndNavigate,
    failure: switchFailure,
    isSwitchingMode,
  } = useAuthModeNavigation();
  const portfolioQuery = useOwnerPortfolioQuery(state.user?.id);
  const session = state.status === "authenticated" ? state.user : null;
  const accessQuery = useBusinessAccessSnapshotQuery(businessId, {
    enabled: Boolean(session && businessId),
  });
  const venuesQuery = useAccessibleVenuesQuery({
    enabled: Boolean(session),
  });

  if (!session || !businessId) return null;

  const venues = venuesQuery.data ?? [];
  const tabVenues = venues.filter((venue) => venue.canEnterBusiness);
  const activeVenue = venues.find((venue) => venue.businessId === businessId);
  const isOwner = activeVenue
    ? activeVenue.source === "ownership"
    : hasOwnedBusiness(portfolioQuery.data, businessId);
  const portfolioBusiness = portfolioQuery.data?.companies
    .flatMap((company) => company.businesses)
    .find((business) => business._id === businessId);

  const dashboardTo = canonicalBusinessDashboardRoutePath(businessId);
  const peopleTo = canonicalBusinessPeoplePath(businessId);
  const openHoursTo = canonicalBusinessSettingsOpenHoursPath(businessId);
  const deliveryTo = canonicalBusinessSettingsDeliveryPath(businessId);
  const metricsTo = canonicalBusinessSettingsMetricsPath(businessId);
  // Owner access is admin-equivalent even when the snapshot omits a layer.
  const canManage =
    canManageVenue(accessQuery.data) || canAdministerVenue(accessQuery.data);

  const pages = [
    {
      key: "dashboard",
      label: t("account.dashboard"),
      to: dashboardTo,
      icon: LayoutDashboard,
      isActive: pathname === dashboardTo,
    },
    ...(canManage
      ? [
          {
            key: "people",
            label: t("business.people"),
            to: peopleTo,
            icon: Users,
            isActive: pathname === peopleTo,
          },
        ]
      : []),
  ];

  const subPages = [
    ...(canManage
      ? [
          {
            key: "settings-open-hours",
            label: t("settings.openHours"),
            to: openHoursTo,
            icon: Clock,
            isActive: pathname === openHoursTo,
            groupName: t("business.manage"),
            groupIcon: Settings,
          },
          {
            key: "settings-delivery",
            label: t("settings.delivery"),
            to: deliveryTo,
            icon: Truck,
            isActive: pathname === deliveryTo,
            groupName: t("business.manage"),
            groupIcon: Settings,
          },
          {
            key: "settings-metrics",
            label: t("settings.metrics"),
            to: metricsTo,
            icon: BarChart3,
            isActive: pathname === metricsTo,
            groupName: t("business.manage"),
            groupIcon: Settings,
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-row">
      <Sidebar collapsible="icon" variant="sidebar">
        <ActorSidebar pages={pages} subPages={subPages} />
        <SidebarFooter>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2"
            disabled={isSwitchingMode}
            aria-busy={isSwitchingMode || undefined}
            onClick={() => {
              void switchModeAndNavigate(
                "customer",
                canonicalCustomerDashboardPath(),
              );
            }}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("account.customerMode")}
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {/* Inset scrolls independently; `peer` + gap from Sidebar reserve horizontal space beside fixed rail. */}
      <div
        data-slot="sidebar-inset"
        className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto bg-background"
      >
        {tabVenues.length > 1 || isOwner ? (
          <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
            {tabVenues.length > 1 ? (
              <BusinessVenueTabs
                venues={tabVenues}
                activeBusinessId={businessId}
              />
            ) : null}
            {isOwner ? (
              <BusinessOwnerChrome
                businessId={businessId}
                companies={portfolioQuery.data?.companies}
                defaultCountry={portfolioQuery.data?.country ?? null}
              />
            ) : null}
          </header>
        ) : null}
        {switchFailure ? (
          <div className="px-6 pt-4">
            <Alert>{resolveError(switchFailure)}</Alert>
          </div>
        ) : null}
        {portfolioBusiness && !portfolioBusiness.profileComplete ? (
          <div className="px-6 pt-4">
            <VenueCompletionWarning businessId={businessId} />
          </div>
        ) : null}
        <Suspense key={pathname} fallback={<AppPendingShell variant="route" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
