import { createElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "@/i18n";
import {
  getLanguageFlag,
  SUPPORTED_LANGUAGES,
  useLanguageOptions,
} from "@/hooks/useLanguageOptions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const rowClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-neutral-700 outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100";

function currentLanguageCode(
  i18nLanguage: string,
): (typeof SUPPORTED_LANGUAGES)[number]["code"] {
  const prefix = (i18nLanguage || "en").split("-")[0]?.toLowerCase() ?? "en";
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code) as readonly string[];
  return codes.includes(prefix)
    ? (prefix as (typeof SUPPORTED_LANGUAGES)[number]["code"])
    : "en";
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation("common");
  const options = useLanguageOptions();
  // `resolvedLanguage` follows fallback (often `en`); use `language` so the trigger flag matches the user’s pick.
  const active = currentLanguageCode(i18n.language);

  const select = (code: string) => {
    void changeAppLanguage(code).then(() => setOpen(false));
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
          aria-label={t("languageSwitcher.ariaLabel")}
          aria-haspopup="dialog"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm"
            aria-hidden
          >
            {createElement(getLanguageFlag(active), {
              className: "h-full w-full object-cover",
              title: "",
            })}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,16rem)] p-1 sm:w-56">
        <div className="flex flex-col gap-0.5">
          {options.map((opt) => {
            const isActive = opt.value === active;
            return (
              <button
                key={opt.value}
                type="button"
                className={rowClass}
                aria-current={isActive ? "true" : undefined}
                onClick={() => select(opt.value)}
              >
                <span
                  className="relative h-6 w-9 shrink-0 overflow-hidden rounded-sm"
                  aria-hidden
                >
                  {createElement(getLanguageFlag(opt.value), {
                    className: "h-full w-full object-cover",
                    title: "",
                  })}
                </span>
                <span className="min-w-0 flex-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
