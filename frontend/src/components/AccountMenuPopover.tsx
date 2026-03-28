import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken, useAuth } from "@/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAccountMenuPaths } from "@/navigation/accountPaths";
import { cn } from "@/lib/utils";

const itemClass =
  "flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-left text-sm text-neutral-700 outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

type AccountMenuPopoverProps = {
  session: AuthSession;
};

export function AccountMenuPopover({ session }: AccountMenuPopoverProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { dispatch } = useAuth();
  const paths = getAccountMenuPaths(session);

  const close = () => setOpen(false);

  const handleLogout = async () => {
    close();
    await logout();
    setAccessToken(null);
    localStorage.removeItem("auth_had_session");
    dispatch({ type: "AUTH_CLEAR" });
    navigate("/", { replace: true });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-full outline-none",
            "focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
          )}
          aria-label="Account menu"
        >
          <div
            className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm"
            aria-hidden
          >
            <span
              className="flex h-full w-full items-center justify-center bg-neutral-100 text-[11px] font-semibold uppercase tracking-tight text-neutral-600"
              aria-hidden
            >
              {initialsFromEmail(session.email)}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-1">
        <p className="truncate px-2 py-1.5 text-xs text-neutral-500">{session.email}</p>
        <Link to={paths.dashboard} className={itemClass} onClick={close}>
          Dashboard
        </Link>
        <Link to={paths.profile} className={itemClass} onClick={close}>
          Profile
        </Link>
        <Link to={paths.favorites} className={itemClass} onClick={close}>
          Favorites
        </Link>
        <button type="button" className={itemClass} onClick={() => void handleLogout()}>
          Log out
        </button>
      </PopoverContent>
    </Popover>
  );
}
