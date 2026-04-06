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
 * 1. **`<Outlet />`** — marketing, `/login`, `/signup`, `/business`, etc.
 * 2. **`Footer`** — **only** on this shell. Email recovery routes use **`RecoveryLayout`** (no footer; see `AppRootShell` for navbar).
 */
import { Outlet } from "react-router-dom";
import Footer from "@/components/Footer";
export default function PublicLayout() {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto bg-neutral-100">
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}
