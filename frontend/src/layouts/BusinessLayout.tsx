/**
 * ## `BusinessLayout` (`src/layouts`)
 * **Parent route:** `path="/business/:businessId"` in `appRoutes.tsx`, wrapped by
 * **`BusinessSessionRouteShell`** (session type + `:businessId` match) before this layout renders.
 *
 * ## Flow
 * Column shell with **`Navbar`** (shared with customer/employee layouts) and **`<Outlet />`** for
 * nested tenant pages (`dashboard`, `settings/profile`, `settings/delivery`, `settings/metrics`,
 * `settings/open-hours`). Account menu links to other settings stubs (`subscriptions`, `address`,
 * `credentials`) — see `AccountMenuPopover`.
 * No footer — see `PublicLayout`.
 *
 * Folder overview: `PublicLayout`, `CustomerLayout`, `EmployeeLayout` — all wired from `appRoutes.tsx`.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import {
  SidebarInset,
} from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { BarChart3, Clock, LayoutDashboard, Truck } from "lucide-react";
import {
  canonicalBusinessDashboardRoutePath,
  canonicalBusinessSettingsDeliveryPath,
  canonicalBusinessSettingsMetricsPath,
  canonicalBusinessSettingsOpenHoursPath,
} from "@/routes/canonicalPaths";

export default function BusinessLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "business") return null;

  const dashboardTo = canonicalBusinessDashboardRoutePath(session);
  const deliveryTo = canonicalBusinessSettingsDeliveryPath(session);
  const metricsTo = canonicalBusinessSettingsMetricsPath(session);
  const openHoursTo = canonicalBusinessSettingsOpenHoursPath(session);

  const items = [
    {
      key: "dashboard",
      label: t("account.dashboard"),
      to: dashboardTo,
      icon: LayoutDashboard,
      isActive: pathname === dashboardTo,
    },
  ];

  const settingsItems = [
    {
      key: "settings-delivery",
      label: t("settings.delivery"),
      to: deliveryTo,
      icon: Truck,
      isActive: pathname === deliveryTo,
    },
    {
      key: "settings-metrics",
      label: t("settings.metrics"),
      to: metricsTo,
      icon: BarChart3,
      isActive: pathname === metricsTo,
    },
    {
      key: "settings-open-hours",
      label: t("settings.openHours"),
      to: openHoursTo,
      icon: Clock,
      isActive: pathname === openHoursTo,
    },
  ];

  return (
    <>
      <ActorSidebar items={items} settingsItems={settingsItems} />
      <SidebarInset>
        <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}
