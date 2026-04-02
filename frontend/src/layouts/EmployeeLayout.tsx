/**
 * ## `EmployeeLayout` (`src/layouts`)
 * **Parent route:** `path="/:userId/employee"` in `appRoutes.tsx`. The route **element** is
 * **`UserSessionRouteShell` → `RequireEmployeeAuthMode` → `EmployeeLayout`**: the mode guard runs
 * **outside** this file (`auth_mode` cookie via `AuthModeContext` / `services/authMode.ts`).
 *
 * ## Flow
 * Same chrome pattern as **`CustomerLayout`**: **`Navbar`** + **`<Outlet />`** for `home`, `profile`,
 * `dashboard`, etc. Wrong or missing employee mode redirects to **`/:userId/mode`** before this layout
 * mounts children.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import {
  SidebarInset,
} from "@/components/ui/sidebar";
import { useAuth } from "@/auth";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Home, LayoutDashboard, User } from "lucide-react";
import {
  canonicalUserCustomerDashboardPath,
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

  const items = [
    {
      key: "profile",
      label: t("account.profile"),
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

  const modeSwitchItems =
    session.canLogAsEmployee === true
      ? [
          {
            key: "customerHome",
            label: t("account.customerHome"),
            to: canonicalUserCustomerDashboardPath(session),
            icon: Home,
            isActive: pathname === canonicalUserCustomerDashboardPath(session),
          },
        ]
      : [];

  return (
    <>
      <ActorSidebar items={items} modeSwitchItems={modeSwitchItems} />
      <SidebarInset>
        <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}
