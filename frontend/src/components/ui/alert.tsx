import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("w-full rounded-md border px-3 py-2 text-sm", {
  variants: {
    tone: {
      error: "border-destructive/30 bg-destructive/10 text-foreground",
      success: "border-success/30 bg-success/10 text-foreground",
      warning: "border-warning/40 bg-warning/20 text-foreground",
      info: "border-info/30 bg-info/10 text-foreground",
    },
  },
  defaultVariants: {
    tone: "error",
  },
});

export function Alert({
  className,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
