import { useTranslation } from "react-i18next";
import { SlidersHorizontal, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken } from "@/auth/api";
import { clearPriorSession } from "@/auth/sessionHint";
import { useAuth } from "@/auth/store/AuthContext";
import { CircularFlag } from "@/components/LanguageFlag";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import { effectiveLanguage } from "@/i18n/config";
import type { AuthMode } from "@/services/authMode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canonicalAccountPath,
  canonicalAccountPreferencesPath,
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
  /** The server-backed Customer | Business mode shown in the summary. */
  mode: AuthMode;
};

export function AccountMenuPopover({ session, mode }: AccountMenuPopoverProps) {
  const { t, i18n } = useTranslation("nav");
  const navigate = useNavigate();
  const { dispatch } = useAuth();
  const languageOptions = useLanguageOptions();
  const activeLanguage = effectiveLanguage(i18n.language);
  const languageLabel =
    languageOptions.find((option) => option.value === activeLanguage)?.label ??
    activeLanguage;

  const actorTypeLabel =
    mode === "business"
      ? t("account.actorType.business")
      : t("account.actorType.customer");

  const handleLogout = async () => {
    await logout();
    setAccessToken(null);
    clearPriorSession();
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
        <div className="flex flex-row items-center justify-between gap-2 px-1.5 pb-2 pt-0.5">
          <div className="min-w-0 flex-1 cursor-default">
            <p className="truncate text-sm font-semibold text-foreground">
              {actorTypeLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.email}
            </p>
          </div>
          <span
            role="img"
            aria-label={t("account.currentLanguage", {
              language: languageLabel,
            })}
            className="flex shrink-0 items-center gap-1.5"
          >
            <CircularFlag code={activeLanguage} sizeClass="h-4 w-4" />
            <span aria-hidden className="text-xs text-muted-foreground">
              {languageLabel}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate(canonicalAccountPath())}
          className="cursor-pointer"
        >
          <User
            className="text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground"
            aria-hidden
          />
          {t("account.account")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate(canonicalAccountPreferencesPath())}
          className="cursor-pointer"
        >
          <SlidersHorizontal
            className="text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground"
            aria-hidden
          />
          {t("account.preferences")}
        </DropdownMenuItem>
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
