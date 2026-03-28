import { Outlet } from "react-router-dom";
import { useAuth } from "@/auth";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";

/**
 * Shell for **`/:userId/employee/*`** — staff / POS area (separate from customer UI).
 * Reached only with **`RequireEmployeeAuthMode`** (`auth_mode=employee`).
 */
export default function EmployeeLayout() {
  const { state } = useAuth();
  const session = state.user;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <header className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        {session ? <AccountMenuPopover session={session} /> : null}
      </header>
      <Outlet />
    </div>
  );
}
