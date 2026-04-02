import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken, useAuth } from "@/auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  canonicalBusinessProfilePath,
  canonicalUserCustomerProfilePath,
} from "@/routes/canonicalPaths";
import { Button } from "./ui/button";

const itemClass =
  "flex w-full cursor-pointer items-center rounded-sm py-2 text-left text-sm text-neutral-700 outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100";

function accountMenuPaths(session: AuthSession) {
  if (session.type === "business") {
    return {
      profile: canonicalBusinessProfilePath(session),
    };
  }
  return {
    profile: canonicalUserCustomerProfilePath(session),
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
          onEmployee: pathname.includes(`/${session.id}/employee`),
        }
      : null;

  const actorTypeLabel =
    session.type === "business"
      ? t("account.actorType.business")
      : userShell?.onEmployee
        ? t("account.actorType.employee")
        : t("account.actorType.customer");

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
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
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
      <PopoverContent className="p-3">
        <div className="flex flex-row justify-between items-center">
          <div>
            <p className="truncate text-md font-bold text-neutral-700 cursor-default">
              {actorTypeLabel}
            </p>
            <p className="truncate text-xs text-neutral-500 cursor-default">
              {session.email}
            </p>
          </div>
          <div className="flex h-full w-full justify-end">
            <LanguageSwitcher />
          </div>
        </div>
        <hr className="mb-2 mt-4" />

        <Button
          variant="ghost"
          size="sm"
          className={`${itemClass} justify-start`}
          onClick={() => {
            navigate(paths.profile);
            close();
          }}
        >
          {t("account.profile")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`${itemClass} justify-start`}
          onClick={() => void handleLogout()}
        >
          {t("account.logOut")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
