/**
 * ## `CustomerLayout` (`src/layouts`)
 * **Parent route:** `path="/:userId/customer"` in `appRoutes.tsx`, wrapped by
 * **`UserSessionRouteShell`** (authenticated person + URL `:userId` matches session) before this layout.
 *
 * ## Flow
 * **Sidebar** + **`SidebarInset`** ( **`SidebarProvider`** is in **`main.tsx`**). **`<Outlet />`** for
 * customer shell children
 * (`home`, `profile`, `favorites`, `dashboard`). Employee mode is chosen elsewhere (`/:userId/mode`);
 * account menu can link to employee **home** when allowed.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, Star, User } from "lucide-react";
import {
  canonicalUserCustomerDashboardPath,
  canonicalUserCustomerFavoritesPath,
  canonicalUserCustomerProfilePath,
} from "@/routes/canonicalPaths";

export default function CustomerLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "user") return null;

  const favoritesTo = canonicalUserCustomerFavoritesPath(session);
  const dashboardTo = canonicalUserCustomerDashboardPath(session);
  const profileTo = canonicalUserCustomerProfilePath(session);

  const pages = [
    {
      key: "favorites",
      label: t("account.favorites"),
      to: favoritesTo,
      icon: Star,
      isActive: pathname === favoritesTo,
    },
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
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <ActorSidebar pages={pages} />
        <SidebarRail />
      </Sidebar>
      <Outlet />
    </>
  );
}
