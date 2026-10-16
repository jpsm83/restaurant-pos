/**
 * ## `BusinessLayout` (`src/layouts`)
 * **Parent route:** `path="/business/:businessId"` in `appRoutes.tsx`, wrapped by
 * **`BusinessSessionRouteShell`** (session type + `:businessId` match) before this layout renders.
 *
 * ## Flow
 * **`SidebarProvider`** wraps routed content in **`main.tsx`**. This layout adds **Sidebar** +
 * **main column** (same flex role as shadcn `SidebarInset`, but a **`div`** so child pages may use `<main>`); **`<Outlet />`** (in **`Suspense`**) renders tenant pages in the main
 * column (`dashboard`,
 * `settings/profile`, `settings/subscriptions`, `settings/address`, `settings/open-hours`,
 * `settings/delivery`, `settings/metrics`, `settings/credentials`). Deeper links also appear in
 * `AccountMenuPopover`.
 * No footer — see `PublicLayout`.
 *
 * Folder overview: `PublicLayout`, `CustomerLayout`, `EmployeeLayout` — all wired from `appRoutes.tsx`.
 */
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { AppPendingShell } from "@/components/AppPendingShell";
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
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-row">
      <Sidebar collapsible="icon" variant="sidebar">
        <ActorSidebar pages={pages} subPages={subPages} />
        <SidebarRail />
      </Sidebar>
      {/* Inset scrolls independently; `peer` + gap from Sidebar reserve horizontal space beside fixed rail. */}
      <div
        data-slot="sidebar-inset"
        className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto bg-background"
      >
        <Suspense key={pathname} fallback={<AppPendingShell variant="route" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
