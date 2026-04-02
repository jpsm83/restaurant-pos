/**
 * ## `BusinessLayout` (`src/layouts`)
 * **Parent route:** `path="/business/:businessId"` in `appRoutes.tsx`, wrapped by
 * **`BusinessSessionRouteShell`** (session type + `:businessId` match) before this layout renders.
 *
 * ## Flow
 * Column shell with **`Navbar`** (shared with customer/employee layouts) and **`<Outlet />`** for
 * nested tenant pages (`home`, `dashboard`, `profile`, …). No footer — see `PublicLayout`.
 *
 * Folder overview: `PublicLayout`, `CustomerLayout`, `EmployeeLayout` — all wired from `appRoutes.tsx`.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import {
  SidebarInset,
} from "@/components/ui/sidebar";
import { useAuth } from "@/auth";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import {
  canonicalBusinessDashboardRoutePath,
} from "@/routes/canonicalPaths";

export default function BusinessLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "business") return null;

  const dashboardTo = canonicalBusinessDashboardRoutePath(session);

  const items = [
    {
      key: "dashboard",
      label: t("account.dashboard"),
      to: dashboardTo,
      icon: LayoutDashboard,
      isActive: pathname === dashboardTo,
    },
  ];

  return (
    <>
      <ActorSidebar items={items} />
      <SidebarInset>
        <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}
