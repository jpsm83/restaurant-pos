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
import Navbar from "@/components/Navbar";
export default function EmployeeLayout() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <Navbar />
      <Outlet />
    </div>
  );
}
