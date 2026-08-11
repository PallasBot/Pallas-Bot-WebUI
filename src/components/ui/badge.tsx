import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "badge",
  {
    variants: {
      variant: {
        default: "badge--info",
        secondary: "badge--neutral",
        destructive: "badge--danger",
        danger: "badge--danger",
        outline: "badge--outline",
        success: "badge--success",
        warn: "badge--warning",
        muted: "badge--muted",
        pending: "badge--pending",
        info: "badge--info",
        neutral: "badge--neutral",
      },
      size: {
        compact: "badge--compact",
        regular: "badge--regular",
      },
    },
    defaultVariants: { variant: "default", size: "regular" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
