import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken, useAuth } from "@/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { canonicalBusinessDashboardPath, canonicalBusinessHomePath, canonicalUserCustomerHomePath, canonicalUserCustomerPath, canonicalUserEmployeeHomePath } from "@/routes/canonicalPaths";

const itemClass =
  "flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-left text-sm text-neutral-700 outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100";

function accountMenuPaths(session: AuthSession) {
  if (session.type === "business") {
    const base = canonicalBusinessDashboardPath(session);
    return {
      dashboard: canonicalBusinessHomePath(session),
      profile: `${base}/profile`,
      favorites: `${base}/favorites`,
    };
  }
  const base = canonicalUserCustomerPath(session);
  return {
    dashboard: canonicalUserCustomerHomePath(session),
    profile: `${base}/profile`,
    favorites: `${base}/favorites`,
  };
}

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
  const { t } = useTranslation("nav");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { dispatch } = useAuth();
  const paths = accountMenuPaths(session);

  const close = () => setOpen(false);

  const userShell =
    session.type === "user"
      ? {
          customer: canonicalUserCustomerHomePath(session),
          employee: canonicalUserEmployeeHomePath(session),
          onCustomer: pathname.includes(`/${session.id}/customer`),
          onEmployee: pathname.includes(`/${session.id}/employee`),
        }
      : null;

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
          aria-label={t("account.menuAriaLabel")}
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
          {t("account.dashboard")}
        </Link>
        <Link to={paths.profile} className={itemClass} onClick={close}>
          {t("account.profile")}
        </Link>
        <Link to={paths.favorites} className={itemClass} onClick={close}>
          {t("account.favorites")}
        </Link>
        {session.type === "user" &&
        session.canLogAsEmployee &&
        userShell &&
        !userShell.onEmployee ? (
          <Link to={userShell.employee} className={itemClass} onClick={close}>
            {t("account.employeeArea")}
          </Link>
        ) : null}
        {userShell?.onEmployee ? (
          <Link to={userShell.customer} className={itemClass} onClick={close}>
            {t("account.customerHome")}
          </Link>
        ) : null}
        <button type="button" className={itemClass} onClick={() => void handleLogout()}>
          {t("account.logOut")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
