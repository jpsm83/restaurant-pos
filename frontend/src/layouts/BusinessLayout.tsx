/**
 * ## `BusinessLayout` (`src/layouts`)
 * **Parent route:** `path="/business/:businessId"` in `appRoutes.tsx`, wrapped by
 * **`BusinessRouteShell`** (authenticated User session) before this layout renders.
 *
 * ## Flow
 * **`SidebarProvider`** wraps routed content in **`main.tsx`**. This layout adds **Sidebar** +
 * **main column** (same flex role as shadcn `SidebarInset`, but a **`div`** so child pages may use `<main>`); **`<Outlet />`** (in **`Suspense`**) renders tenant pages in the main
 * column (`dashboard`,
 * `settings/profile`, `settings/subscriptions`, `settings/address`, `settings/open-hours`,
 * `settings/delivery`, `settings/metrics`).
 * The sidebar footer carries the minimal return-to-customer action; full
 * Customer | Business chrome remains on its later navigation row.
 *
 * Folder overview: `PublicLayout`, `CustomerLayout`, `EmployeeLayout` — all wired from `appRoutes.tsx`.
 */
import { Suspense } from "react";
import { Outlet, useParams } from "react-router-dom";
import { AppPendingShell } from "@/components/AppPendingShell";
import ActorSidebar from "@/components/ActorSidebar";
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
  Building2,
  Clock,
  LayoutDashboard,
  Settings,
  Truck,
} from "lucide-react";
import { useAuthModeNavigation } from "@/hooks/useAuthModeNavigation";
import { useErrorMessage } from "@/i18n/errorCopy";
import {
  hasOwnedBusiness,
  useOwnerPortfolioQuery,
} from "@/services/portfolio/portfolioService";
import {
  canonicalBusinessCompanyPath,
  canonicalBusinessDashboardRoutePath,
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
  if (!session || !businessId) return null;

  const dashboardTo = canonicalBusinessDashboardRoutePath(businessId);
  const companyTo = canonicalBusinessCompanyPath(businessId);
  const openHoursTo = canonicalBusinessSettingsOpenHoursPath(businessId);
  const deliveryTo = canonicalBusinessSettingsDeliveryPath(businessId);
  const metricsTo = canonicalBusinessSettingsMetricsPath(businessId);

  const pages = [
    {
      key: "dashboard",
      label: t("account.dashboard"),
      to: dashboardTo,
      icon: LayoutDashboard,
      isActive: pathname === dashboardTo,
    },
    ...(hasOwnedBusiness(portfolioQuery.data, businessId)
      ? [
          {
            key: "company",
            label: t("owner.company"),
            to: companyTo,
            icon: Building2,
            isActive: pathname === companyTo,
          },
        ]
      : []),
  ];

  const subPages = [
    {
      key: "settings-open-hours",
      label: t("settings.openHours"),
      to: openHoursTo,
      icon: Clock,
      isActive: pathname === openHoursTo,
      groupName: t("settings.settings"),
      groupIcon: Settings,
    },
    {
      key: "settings-delivery",
      label: t("settings.delivery"),
      to: deliveryTo,
      icon: Truck,
      isActive: pathname === deliveryTo,
      groupName: t("settings.settings"),
      groupIcon: Settings,
    },
    {
      key: "settings-metrics",
      label: t("settings.metrics"),
      to: metricsTo,
      icon: BarChart3,
      isActive: pathname === metricsTo,
      groupName: t("settings.settings"),
      groupIcon: Settings,
    },
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
        {switchFailure ? (
          <div className="px-6 pt-4">
            <Alert>{resolveError(switchFailure)}</Alert>
          </div>
        ) : null}
        <Suspense key={pathname} fallback={<AppPendingShell variant="route" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
