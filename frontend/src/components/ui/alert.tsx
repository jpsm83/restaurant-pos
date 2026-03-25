import * as React from "react";
import { cn } from "@/packages/utils";

export function Alert({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn(
        "w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
        className
      )}
      {...props}
    />
  );
}
