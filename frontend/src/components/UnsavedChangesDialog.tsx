import { useTranslation } from "react-i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UnsavedChangesDialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  description?: string;
  stayLabel?: string;
  leaveLabel?: string;
  isLeaving?: boolean;
  className?: string;
};

/**
 * Reusable "unsaved changes" confirmation dialog.
 * Parent controls `open`; callbacks define Stay/Leave behavior per page flow.
 */
export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
  title,
  description,
  stayLabel,
  leaveLabel,
  isLeaving = false,
  className,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation("common");
  const resolvedTitle = title ?? t("unsavedChanges.title");
  const resolvedDescription = description ?? t("unsavedChanges.description");
  const resolvedStayLabel = stayLabel ?? t("unsavedChanges.stay");
  const resolvedLeaveLabel = leaveLabel ?? t("unsavedChanges.leave");

  return (
    <DialogPrimitive.Root
      open={open}
      // Non-modal avoids `react-remove-scroll` on the document (modal overlay locks body scroll
      // and hides the scrollbar, which shifts fixed-width layouts). Backdrop is a plain layer below.
      modal={false}
      onOpenChange={(nextOpen) => {
        // Dismiss (escape / outside click) maps to "stay" to keep navigation intent explicit.
        if (!nextOpen) onStay();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Radix omits `Dialog.Overlay` when `modal={false}`; this div does not use RemoveScroll. */}
        <div className="fixed inset-0 z-overlay bg-overlay" aria-hidden />
        <DialogPrimitive.Content
          aria-describedby="unsaved-changes-description"
          className={cn(
            "fixed left-1/2 top-1/2 z-modal dialog-width max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-5 shadow-lg outline-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="text-base font-semibold text-popover-foreground">
            {resolvedTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id="unsaved-changes-description"
            className="mt-2 text-sm text-muted-foreground"
          >
            {resolvedDescription}
          </DialogPrimitive.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onStay}>
              {resolvedStayLabel}
            </Button>
            <Button type="button" variant="destructive" onClick={onLeave} disabled={isLeaving}>
              {isLeaving
                ? (leaveLabel ?? t("unsavedChanges.leaving"))
                : resolvedLeaveLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
