import { US, ES } from "country-flag-icons/react/1x1";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { changeAppLanguage } from "@/i18n/i18n";
import { isSupportedLanguage } from "@/i18n/config";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

function isEs(code: string): boolean {
  return (code.split("-")[0]?.toLowerCase() ?? "") === "es";
}

function activeCode(i18nLanguage: string): "en" | "es" {
  return isEs(i18nLanguage || "en") ? "es" : "en";
}

function LanguageFlagIcon({
  code,
  className,
  preserveAspectRatio,
  "aria-hidden": ariaHidden,
  focusable,
}: {
  code: string;
  className?: string;
  preserveAspectRatio?: string;
  "aria-hidden"?: boolean | "true" | "false";
  focusable?: "false" | "true" | boolean;
}) {
  const common = {
    className,
    preserveAspectRatio,
    "aria-hidden": ariaHidden,
    focusable,
  } as const;
  return isEs(code) ? <ES {...common} /> : <US {...common} />;
}

/**
 * Square 1×1 flags (`country-flag-icons/react/1x1`) fill the circle; `slice` avoids letterboxing
 * when a flag’s viewBox is slightly off-square.
 */
function CircularFlag({
  code,
  sizeClass,
  withBorder = true,
}: {
  code: string;
  sizeClass: string;
  withBorder?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        withBorder && "border border-border shadow-sm",
        sizeClass,
      )}
    >
      <LanguageFlagIcon
        code={code}
        aria-hidden
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 block size-full max-h-none max-w-none"
      />
    </span>
  );
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const { state, dispatch } = useAuth();
  const options = useLanguageOptions();
  const active = activeCode(i18n.language);

  async function changeLanguage(code: string) {
    await changeAppLanguage(code);

    const user =
      state.status === "authenticated" && state.user?.type === "user"
        ? state.user
        : null;
    if (!user || !isSupportedLanguage(code) || user.languagePreference === code) {
      return;
    }

    const formData = new FormData();
    formData.append("languagePreference", code);
    const result = await updateUserProfile(user.id, formData);
    if (!result.ok) {
      toast.error(t("languageSwitcher.saveError"));
      return;
    }
    dispatch({
      type: "AUTH_SUCCESS",
      payload: { ...user, languagePreference: code },
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={null}
          className="hover:bg-transparent hover:cursor-pointer"
          aria-label={t("languageSwitcher.ariaLabel")}
        >
          <CircularFlag code={active} sizeClass="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-45 max-w-sm p-2"
        onFocusOutside={(e: Event) => e.preventDefault() }
      >
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(code) => void changeLanguage(code)}
        >
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              <CircularFlag code={opt.value} sizeClass="h-4 w-4" />
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
