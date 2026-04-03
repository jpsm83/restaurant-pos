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
  title = "You have unsaved changes",
  description = "If you leave now, your changes will be lost. Do you want to continue?",
  stayLabel = "Stay on page",
  leaveLabel = "Leave without saving",
  isLeaving = false,
  className,
}: UnsavedChangesDialogProps) {
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
        <div className="fixed inset-0 z-50 bg-black/35" aria-hidden />
        <DialogPrimitive.Content
          aria-describedby="unsaved-changes-description"
          className={cn(
            "fixed left-1/2 top-1/2 z-51 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-neutral-200 bg-white p-5 shadow-lg outline-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="text-base font-semibold text-neutral-900">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id="unsaved-changes-description"
            className="mt-2 text-sm text-neutral-600"
          >
            {description}
          </DialogPrimitive.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onStay}>
              {stayLabel}
            </Button>
            <Button type="button" variant="destructive" onClick={onLeave} disabled={isLeaving}>
              {isLeaving ? "Leaving..." : leaveLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
