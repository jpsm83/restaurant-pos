import { useTranslation } from "react-i18next";
import { CreditCard, KeyRound, MapPin, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canonicalBusinessProfilePath,
  canonicalBusinessSettingsAddressPath,
  canonicalBusinessSettingsCredentialsPath,
  canonicalBusinessSettingsSubscriptionsPath,
  canonicalUserCustomerProfilePath,
} from "@/routes/canonicalPaths";

function profilePathForSession(session: AuthSession): string {
  return session.type === "business"
    ? canonicalBusinessProfilePath(session)
    : canonicalUserCustomerProfilePath(session);
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { dispatch } = useAuth();
  const profileTo = profilePathForSession(session);

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
    await logout();
    setAccessToken(null);
    localStorage.removeItem("auth_had_session");
    dispatch({ type: "AUTH_CLEAR" });
    navigate("/", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[240px] max-w-sm p-2"
      >
        <div
          className="flex flex-row items-center justify-between gap-2 px-1.5 pb-2 pt-0.5"
          onPointerDown={(e) => e.preventDefault()}
        >
          <div className="min-w-0 flex-1 cursor-default">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {actorTypeLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.email}
            </p>
          </div>
          <div className="shrink-0" onPointerDown={(e) => e.preventDefault()}>
            <LanguageSwitcher nestedInDropdown />
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
        {session.type === "business" ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                navigate(canonicalBusinessSettingsAddressPath(session))
              }
            >
              <MapPin
                className="text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground"
                aria-hidden
              />
              {t("settings.address")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                navigate(canonicalBusinessSettingsSubscriptionsPath(session))
              }
            >
              <CreditCard
                className="text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground"
                aria-hidden
              />
              {t("settings.subscriptions")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                navigate(canonicalBusinessSettingsCredentialsPath(session))
              }
            >
              <KeyRound
                className="text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground"
                aria-hidden
              />
              {t("settings.credentials")}
            </DropdownMenuItem>
          </>
        ) : null}
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
