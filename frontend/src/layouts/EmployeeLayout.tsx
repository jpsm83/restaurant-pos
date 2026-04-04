/**
 * ## `EmployeeLayout` (`src/layouts`)
 * **Parent route:** `path="/:userId/employee"` in `appRoutes.tsx`. The route **element** is
 * **`UserSessionRouteShell` → `RequireEmployeeAuthMode` → `EmployeeLayout`**: the mode guard runs
 * **outside** this file (`auth_mode` cookie via `AuthModeContext` / `services/authMode.ts`).
 *
 * ## Flow
 * Same chrome pattern as **`CustomerLayout`** (**`SidebarProvider`** in **`main.tsx`**) +
 * **`<Outlet />`** for `home`, `profile`, `dashboard`, etc. Wrong or missing employee mode redirects to
 * **`/:userId/mode`** before this layout mounts children.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, User } from "lucide-react";
import {
  canonicalUserEmployeeDashboardPath,
  canonicalUserEmployeeProfilePath,
} from "@/routes/canonicalPaths";

export default function EmployeeLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "user") return null;

  const dashboardTo = canonicalUserEmployeeDashboardPath(session);
  const profileTo = canonicalUserEmployeeProfilePath(session);

  const pages = [
    {
      key: "profile",
      label: t("settings.profile"),
      to: profileTo,
      icon: User,
      isActive: pathname === profileTo,
    },
    {
      key: "dashboard",
      label: t("account.dashboard"),
      to: dashboardTo,
      icon: LayoutDashboard,
      isActive: pathname === dashboardTo,
    },
  ];

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-row">
      <Sidebar collapsible="icon" variant="sidebar">
        <ActorSidebar pages={pages} />
        <SidebarRail />
      </Sidebar>
      <div
        data-slot="sidebar-inset"
        className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto bg-background"
      >
        <Outlet />
      </div>
    </div>
  );
}
