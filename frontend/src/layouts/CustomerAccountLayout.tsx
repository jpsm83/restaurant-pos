/**
 * ## `CustomerAccountLayout` (`src/layouts`)
 * **Parent route:** pathless in `appRoutes.tsx`, wrapped by **`ProtectedRoute`** before this layout.
 * The account area is the single global User surface: it is session-derived
 * (`/account/profile`, `/account/address`, `/account/security`, `/account/notifications`,
 * `/account/preferences`, `/account/orders`) and opens from either Customer or Business mode
 * without changing the stored mode. The person comes from the session and no User id appears in
 * the URL (ADR-0018).
 *
 * ## Flow
 * **Sidebar** + **`SidebarInset`** ( **`SidebarProvider`** is in **`main.tsx`**). **`<Outlet />`**
 * renders the account destinations. **Orders** is the approved placeholder until the
 * order-history surface ships; any other entry must be a built destination.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import ActorSidebar from "@/components/ActorSidebar";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useAuth } from "@/auth/store/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  Bell,
  MapPin,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  User,
} from "lucide-react";
import {
  canonicalAccountAddressPath,
  canonicalAccountNotificationsPath,
  canonicalAccountOrdersPath,
  canonicalAccountPreferencesPath,
  canonicalAccountProfilePath,
  canonicalAccountSecurityPath,
} from "@/routes/canonicalPaths";

export default function CustomerAccountLayout() {
  const { state } = useAuth();
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();

  const session = state.status === "authenticated" ? state.user : null;
  if (!session || session.type !== "user") return null;

  const profileTo = canonicalAccountProfilePath();
  const addressTo = canonicalAccountAddressPath();
  const securityTo = canonicalAccountSecurityPath();
  const notificationsTo = canonicalAccountNotificationsPath();
  const preferencesTo = canonicalAccountPreferencesPath();
  const ordersTo = canonicalAccountOrdersPath();

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
    {
      key: "security",
      label: t("account.security"),
      to: securityTo,
      icon: ShieldCheck,
      isActive: pathname === securityTo,
    },
    {
      key: "notifications",
      label: t("account.notifications"),
      to: notificationsTo,
      icon: Bell,
      isActive: pathname === notificationsTo,
    },
    {
      key: "preferences",
      label: t("account.preferences"),
      to: preferencesTo,
      icon: SlidersHorizontal,
      isActive: pathname === preferencesTo,
    },
    {
      key: "orders",
      label: t("account.orders"),
      to: ordersTo,
      icon: ReceiptText,
      isActive: pathname === ordersTo,
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
