/**
 * **`src/layouts`** — route **outlet shells** (chrome + `<Outlet />` for nested pages). Wired only from
 * `appRoutes.tsx`. Auth gates live on the **parent `<Route>`** (`PublicOnlyRoute`, `UserSessionRouteShell`,
 * … in `routes/AuthRouteGuards.tsx`), not inside these layout components.
 *
 * ---
 *
 * ## `PublicLayout` (this file)
 * **Parent route:** `path="/"` in `appRoutes.tsx` (no session shell guard on the layout itself; children
 * use `PublicOnlyRoute` where login/signup should reject an existing session).
 *
 * ## Flow
 * 1. **`SiteAudienceProvider`** — marketing audience from URL (`/` vs `/business/*`) for `Navbar`
 *    sign-in / sign-up links (`useSiteAudience` throws outside this tree; other layouts use
 *    `useOptionalSiteAudience` in `Navbar`).
 * 2. **`Navbar`** — public CTAs or account popover when authenticated on a public child.
 * 3. **`<Outlet />`** — index marketing, `/login`, `/signup`, `/business`, `/business/register`.
 * 4. **`Footer`** — **only** on this shell; tenant / user shells omit it.
 */
import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { SiteAudienceProvider } from "@/context/SiteAudienceContext";
import Footer from "@/components/Footer";
export default function PublicLayout() {
  return (
    <SiteAudienceProvider>
      <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
        <Navbar />
        <Outlet />
        <Footer />
      </div>
    </SiteAudienceProvider>
  );
}
