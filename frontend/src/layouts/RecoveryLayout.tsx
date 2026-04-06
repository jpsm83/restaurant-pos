/**
 * Minimal shell for **email-driven** flows (reset password, confirm email, etc.): full viewport,
 * no marketing footer, no global navbar (see `AppRootShell` in `main.tsx`).
 */
import { Outlet } from "react-router-dom";

export default function RecoveryLayout() {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto bg-neutral-100">
      <Outlet />
    </div>
  );
}
