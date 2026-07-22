import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type UiBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ok"
  | "warn"
  | "muted"
  | "destructive";

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: UiBadgeVariant;
  children: ReactNode;
};

export default function UiBadge({ variant = "secondary", className, children, ...rest }: Props) {
  return (
    <span {...rest} className={cn("ui-badge", `ui-badge--${variant}`, className)}>
      {children}
    </span>
  );
}
