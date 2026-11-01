/**
 * ## `CustomerLayout` (`src/layouts`)
 * **Parent route:** pathless in `appRoutes.tsx`, wrapped by **`ProtectedRoute`** before this layout.
 * The routes are `/dashboard` and `/favorites`; the person comes from the session. Account
 * settings live in the separate `CustomerAccountLayout` (`/account/*`).
 *
 * ## Flow
 * **Sidebar** + **`SidebarInset`** ( **`SidebarProvider`** is in **`main.tsx`**). **`<Outlet />`** for
 * customer shell children (`favorites`, `dashboard`). Employee mode is chosen elsewhere (`/mode`);
 * the avatar menu opens the account area.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, Star } from "lucide-react";
import {
  canonicalCustomerDashboardPath,
  canonicalCustomerFavoritesPath,
} from "@/routes/canonicalPaths";

export default function CustomerLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "user") return null;

  const favoritesTo = canonicalCustomerFavoritesPath();
  const dashboardTo = canonicalCustomerDashboardPath();

  const pages = [
    {
      key: "favorites",
      label: t("account.favorites"),
      to: favoritesTo,
      icon: Star,
      isActive: pathname === favoritesTo,
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
