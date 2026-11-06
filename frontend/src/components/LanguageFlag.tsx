import { US, ES } from "country-flag-icons/react/1x1";
import { cn } from "@/lib/utils";

function isEs(code: string): boolean {
  return (code.split("-")[0]?.toLowerCase() ?? "") === "es";
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
export function CircularFlag({
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
