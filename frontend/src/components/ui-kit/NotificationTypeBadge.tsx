import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const notificationTypeBadgeVariants = cva(
  "rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        warning: "bg-warning/20 text-foreground",
        danger: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type NotificationTypeTone = NonNullable<
  VariantProps<typeof notificationTypeBadgeVariants>["tone"]
>;

export function NotificationTypeBadge({
  tone,
  className,
  children,
}: {
  tone: NotificationTypeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn(notificationTypeBadgeVariants({ tone }), className)}>
      {children}
    </span>
  );
}
