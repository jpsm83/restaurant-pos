import { useState } from "react";
import { US, ES } from "country-flag-icons/react/3x2";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "@/i18n/i18n";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function isEs(code: string): boolean {
  return (code.split("-")[0]?.toLowerCase() ?? "") === "es";
}

function activeCode(i18nLanguage: string): "en" | "es" {
  return isEs(i18nLanguage || "en") ? "es" : "en";
}

function LanguageFlagIcon({ code, className }: { code: string; className?: string }) {
  return isEs(code) ? <ES className={className} /> : <US className={className} />;
}

/**
 * Clips a 3×2 flag SVG to a circle. Inner track is 150% × 100% of the square (3:2) so the flag
 * fills the circle; horizontal overflow is cropped equally.
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
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full",
        withBorder && "border border-neutral-200 shadow-sm",
        sizeClass,
      )}
      aria-hidden
    >
      <span className="pointer-events-none absolute left-1/2 top-0 h-full w-[150%] -translate-x-1/2">
        <LanguageFlagIcon
          code={code}
          className="block h-full w-full object-cover object-center"
        />
      </span>
    </span>
  );
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  // `i18n.language` follows init in `@/i18n/i18n` (storage, else `navigator`, else `en`).
  const { t, i18n } = useTranslation("common");
  const options = useLanguageOptions();
  const active = activeCode(i18n.language);

  const select = (code: string) => {
    void changeAppLanguage(code).then(() => setOpen(false));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 cursor-pointer shadow-sm hover:shadow-md"
          aria-label={t("languageSwitcher.ariaLabel")}
          aria-haspopup="dialog"
        >
          <CircularFlag code={active} sizeClass="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
      >
        <div className="flex flex-col gap-1">
          {options.map((opt) => {
            const isActive = opt.value === active;
            return (
              <button
                key={opt.value}
                type="button"
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2 pr-6 text-sm text-neutral-700 outline-none hover:bg-neutral-100"
                aria-current={isActive ? "true" : undefined}
                onClick={() => select(opt.value)}
              >
                <CircularFlag code={opt.value} sizeClass="h-6 w-6" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
