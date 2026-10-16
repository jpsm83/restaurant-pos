import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared outer chrome for route + session pending so refresh and lazy load feel the same. */
const PENDING_SHELL_CLASS =
  "flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4 bg-neutral-100 p-4";

/**
 * Shared full-area pending UI (only shadcn `Skeleton` for placeholder visuals). Two reasons we wait:
 * - **route**: lazy route chunks (`React.lazy` / dynamic `import()`).
 * - **session**: auth bootstrap, guards, or auth-mode fetch — not code splitting.
 * Status copy stays screen-reader-only so the shell matches page-level skeleton UX.
 */
export function AppPendingShell({
  variant,
  message,
}: {
  variant: "route" | "session";
  /** Used when `variant === "session"` (e.g. guards). Overrides default session copy for `aria-label` / sr-only. */
  message?: string;
}) {
  const { t } = useTranslation("common");
  const sessionMessage = message ?? t("loading.session");
  const routeLabel = t("loading.route");

  if (variant === "route") {
    return (
      <div className={PENDING_SHELL_CLASS}>
        <span className="sr-only">{routeLabel}</span>
        {/* Single block: lazy chunk has no stable layout to mirror yet. */}
        <Skeleton className="min-h-0 flex-1 w-full" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={PENDING_SHELL_CLASS}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={sessionMessage}
    >
      <span className="sr-only">{sessionMessage}</span>
      {/* Strip + body loosely mirrors layout shells (nav band + main). */}
      <Skeleton className="h-12 w-full shrink-0" aria-hidden />
      <Skeleton className="min-h-0 flex-1 w-full" aria-hidden />
    </div>
  );
}
