import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared full-area pending UI. Two reasons we wait:
 * - **route**: lazy route chunks (`React.lazy` / dynamic `import()`).
 * - **session**: auth bootstrap, guards, or auth-mode fetch — not code splitting.
 */
export function AppPendingShell({
  variant,
  message,
}: {
  variant: "route" | "session";
  /** Used when `variant === "session"` (e.g. guards). Overrides default session copy. */
  message?: string;
}) {
  const { t } = useTranslation("common");
  const sessionMessage = message ?? t("loading.session");

  if (variant === "route") {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 bg-neutral-100 p-4">
        <span className="sr-only">{t("loading.route")}</span>
        <Skeleton className="min-h-0 flex-1 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 bg-neutral-100 p-4">
      <Skeleton className="h-10 w-40 shrink-0 rounded-md" />
      <p className="text-sm text-neutral-600">{sessionMessage}</p>
    </div>
  );
}
