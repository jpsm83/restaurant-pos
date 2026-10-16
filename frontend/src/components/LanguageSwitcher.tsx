import { US, ES } from "country-flag-icons/react/1x1";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "@/i18n/i18n";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      className={`relative shrink-0 overflow-hidden rounded-full ${withBorder && "border border-neutral-200 shadow-sm"} ${sizeClass} aria-hidden`}
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
  const options = useLanguageOptions();
  const active = activeCode(i18n.language);

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
        className="min-w-[180px] max-w-sm p-2"
        onFocusOutside={(e: Event) => e.preventDefault() }
      >
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(code) => void changeAppLanguage(code)}
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
