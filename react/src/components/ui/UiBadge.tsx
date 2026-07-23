/**
 * @deprecated 新代码请直接用 `@/components/ui/badge` 的 `Badge`。
 */
import type { HTMLAttributes, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type UiBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ok"
  | "warn"
  | "muted"
  | "destructive";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: UiBadgeVariant;
  children: ReactNode;
};

function mapVariant(
  v: UiBadgeVariant,
): "default" | "secondary" | "outline" | "success" | "warn" | "muted" | "destructive" {
  if (v === "ok") return "success";
  return v;
}

export default function UiBadge({ variant = "secondary", className, children, ...rest }: Props) {
  return (
    <Badge {...rest} variant={mapVariant(variant)} className={cn(className)}>
      {children}
    </Badge>
  );
}
