/**
 * ## `BusinessLayout` (`src/layouts`)
 * **Parent route:** `path="/business/:businessId"` in `appRoutes.tsx`, wrapped by
 * **`BusinessSessionRouteShell`** (session type + `:businessId` match) before this layout renders.
 *
 * ## Flow
 * **`SidebarProvider`** wraps routed content in **`main.tsx`**. This layout adds **Sidebar** +
 * **`SidebarInset`**; **`<Outlet />`** renders tenant pages in **`SidebarInset`** (`dashboard`,
 * `settings/profile`, `settings/subscriptions`, `settings/address`, `settings/open-hours`,
 * `settings/delivery`, `settings/metrics`, `settings/credentials`). Deeper links also appear in
 * `AccountMenuPopover`.
 * No footer — see `PublicLayout`.
 *
 * Folder overview: `PublicLayout`, `CustomerLayout`, `EmployeeLayout` — all wired from `appRoutes.tsx`.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  BarChart3,
  Clock,
  LayoutDashboard,
  Settings,
  Truck,
} from "lucide-react";
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
  const openHoursTo = canonicalBusinessSettingsOpenHoursPath(session);
  const deliveryTo = canonicalBusinessSettingsDeliveryPath(session);
  const metricsTo = canonicalBusinessSettingsMetricsPath(session);

  const pages = [
    {
      key: "dashboard",
      label: t("account.dashboard"),
      to: dashboardTo,
      icon: LayoutDashboard,
      isActive: pathname === dashboardTo,
    },
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
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <ActorSidebar pages={pages} subPages={subPages} />
        <SidebarRail />
      </Sidebar>
      <Outlet />
    </>
  );
}
