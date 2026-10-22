import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Chip } from "@heroui/react";

const badgeVariants = cva("badge", {
  variants: {
    variant: {
      default: "badge--info chip--accent chip--soft",
      secondary: "badge--neutral chip--secondary chip--default chip--soft",
      destructive: "badge--danger chip--danger chip--soft",
      danger: "badge--danger chip--danger chip--soft",
      outline: "badge--outline chip--tertiary chip--default",
      success: "badge--success chip--success chip--soft",
      warn: "badge--warning chip--warning chip--soft",
      muted: "badge--muted chip--default chip--soft",
      pending: "badge--pending chip--default chip--soft",
      info: "badge--info chip--accent chip--soft",
      neutral: "badge--neutral chip--default chip--soft",
    },
    size: {
      compact: "badge--compact chip--sm",
      regular: "badge--regular chip--md",
    },
  },
  defaultVariants: { variant: "default", size: "regular" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, color: _color, ...props }: BadgeProps) {
  return (
    <Chip className={cn(badgeVariants({ variant, size }), className)} {...props}>
      <Chip.Label>{props.children}</Chip.Label>
    </Chip>
  );
}

export { Badge, badgeVariants };
