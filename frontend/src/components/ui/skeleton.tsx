import { cn } from "@/lib/utils";

/**
 * Central loading placeholder: pulse + fill live here only.
 * Compose in page shells and `AppPendingShell`; do not duplicate `animate-pulse` on raw `div`s.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
