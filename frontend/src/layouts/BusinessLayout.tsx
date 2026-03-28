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
import Navbar from "@/components/Navbar";
export default function BusinessLayout() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <Navbar />
      <Outlet />
    </div>
  );
}
