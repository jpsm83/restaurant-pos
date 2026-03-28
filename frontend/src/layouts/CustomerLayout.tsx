import { Link, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { Button } from "@/components/ui/button";

/**
 * Shell for **`/:userId/customer/*`** — browsing / account area (no public marketing chrome).
 * Link to staff tools when `canLogAsEmployee` is true.
 */
export default function CustomerLayout() {
  const { userId } = useParams();
  const { state } = useAuth();

  const session = state.user;
  const showEmployeeLink =
    session?.type === "user" &&
    Boolean(session.employeeId) &&
    session.canLogAsEmployee === true;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/imperium.png"
            alt=""
            className="h-8 w-10 object-contain"
            width={32}
            height={32}
          />
          <span className="text-md font-semibold text-neutral-800">
            Project Imperium POS
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {showEmployeeLink && userId ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/${userId}/employee`}>Employee</Link>
            </Button>
          ) : null}
          {session ? <AccountMenuPopover session={session} /> : null}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
