import { useTranslation } from "react-i18next";
import { SlidersHorizontal, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AuthSession } from "@/auth/types";
import { logout, setAccessToken } from "@/auth/api";
import { clearPriorSession } from "@/auth/sessionHint";
import { useAuth } from "@/auth/store/AuthContext";
import { CircularFlag } from "@/components/LanguageFlag";
import { UserAvatar } from "@/components/UserAvatar";
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

type AccountMenuPopoverProps = {
  session: AuthSession;
  /** The server-backed Customer | Business mode shown in the summary. */
  mode: AuthMode;
};

export function AccountMenuPopover({ session, mode }: AccountMenuPopoverProps) {
  const { t, i18n } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const { dispatch } = useAuth();
  const activeLanguage = effectiveLanguage(i18n.language);
  const languageLabel = tCommon(`languages.${activeLanguage}`);
  const avatarName =
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.email;

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
          <UserAvatar
            imageUrl={session.imageUrl}
            fallback={avatarName}
            className="h-9 w-9 shadow-sm"
          />
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
