import { useTranslation } from "react-i18next";
import { User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isThemeMode, useTheme } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canonicalUserCustomerProfilePath,
  canonicalUserEmployeeProfilePath,
} from "@/routes/canonicalPaths";

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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { dispatch } = useAuth();
  const { mode, setMode } = useTheme();

  const onEmployee = pathname.includes(`/${session.id}/employee`);
  const profileTo = onEmployee
    ? canonicalUserEmployeeProfilePath(session)
    : canonicalUserCustomerProfilePath(session);
  const actorTypeLabel = onEmployee
    ? t("account.actorType.employee")
    : t("account.actorType.customer");

  const handleModeChange = (value: string) => {
    if (isThemeMode(value)) setMode(value);
  };

  const handleLogout = async () => {
    await logout();
    setAccessToken(null);
    localStorage.removeItem("auth_had_session");
    dispatch({ type: "AUTH_CLEAR" });
    navigate("/", { replace: true });
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t("account.menuAriaLabel")}
        >
          <div
            className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-background shadow-sm"
            aria-hidden
          >
            <span
              className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold uppercase tracking-tight text-muted-foreground"
              aria-hidden
            >
              {initialsFromEmail(session.email)}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-60 max-w-sm p-2"
      >
        <div
          className="flex flex-row items-center justify-between gap-2 px-1.5 pb-2 pt-0.5"
          onPointerDown={(e) => e.preventDefault()}
        >
          <div className="min-w-0 flex-1 cursor-default">
            <p className="truncate text-sm font-semibold text-foreground">
              {actorTypeLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.email}
            </p>
          </div>
          <div className="shrink-0" onPointerDown={(e) => e.preventDefault()}>
            <LanguageSwitcher />
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(profileTo)} className="cursor-pointer">
          <User
            className="text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground"
            aria-hidden
          />
          {t("settings.profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("account.theme.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={handleModeChange}
          aria-label={t("account.theme.groupLabel")}
        >
          <DropdownMenuRadioItem value="light">
            {t("account.theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            {t("account.theme.dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            {t("account.theme.system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void handleLogout()}
        >
          {t("account.logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
