/**
 * ## `CustomerLayout` (`src/layouts`)
 * **Parent route:** `path="/:userId/customer"` in `appRoutes.tsx`, wrapped by
 * **`UserSessionRouteShell`** (authenticated person + URL `:userId` matches session) before this layout.
 *
 * ## Flow
 * **`Navbar`** + **`<Outlet />`** for customer shell children (`home`, `profile`, `favorites`,
 * `dashboard`). Employee mode is chosen elsewhere (`/:userId/mode`); account menu can link to
 * employee **home** when allowed.
 *
 * Folder overview: see `PublicLayout.tsx` module doc for how layouts relate.
 */
import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
export default function CustomerLayout() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <Navbar />
      <Outlet />
    </div>
  );
}
