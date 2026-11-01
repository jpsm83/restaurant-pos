/**
 * ## `CustomerAccountLayout` (`src/layouts`)
 * **Parent route:** pathless in `appRoutes.tsx`, wrapped by **`ProtectedRoute`** before this layout.
 * The account area is session-derived (`/account/profile`, `/account/address`); the person comes
 * from the session and no User id appears in the URL.
 *
 * ## Flow
 * **Sidebar** + **`SidebarInset`** ( **`SidebarProvider`** is in **`main.tsx`**). **`<Outlet />`**
 * renders the account destinations built in this slice. Later slices add their own entries;
 * no inert placeholders belong here.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { MapPin, User } from "lucide-react";
import {
  canonicalAccountAddressPath,
  canonicalAccountProfilePath,
} from "@/routes/canonicalPaths";

export default function CustomerAccountLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "user") return null;

  const profileTo = canonicalAccountProfilePath();
  const addressTo = canonicalAccountAddressPath();

  const pages = [
    {
      key: "profile",
      label: t("account.profile"),
      to: profileTo,
      icon: User,
      isActive: pathname === profileTo,
    },
    {
      key: "address",
      label: t("account.address"),
      to: addressTo,
      icon: MapPin,
      isActive: pathname === addressTo,
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
