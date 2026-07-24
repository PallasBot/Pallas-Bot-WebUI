import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 满高画布：占满 shell__main-inner--fill，子内容在内部滚动。 */
export default function PageFill({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn("page-fill", className)}>{children}</Tag>;
}
