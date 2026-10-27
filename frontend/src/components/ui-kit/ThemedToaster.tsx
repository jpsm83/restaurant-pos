import { Toaster } from "sonner";
import { useTheme } from "@/hooks/useTheme";

export function ThemedToaster() {
  const { resolvedMode } = useTheme();

  return (
    <Toaster
      theme={resolvedMode}
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "pos-toast",
          title: "pos-toast-title",
          description: "pos-toast-description",
          actionButton: "pos-toast-action",
          cancelButton: "pos-toast-cancel",
          closeButton: "pos-toast-close",
          error: "pos-toast-error",
          success: "pos-toast-success",
          warning: "pos-toast-warning",
          info: "pos-toast-info",
        },
      }}
    />
  );
}
