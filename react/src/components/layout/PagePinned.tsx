import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 钉在 PageFill 顶部的 chrome（标题 / 工具条），不参与内部滚动伸缩。
 * 对齐 Vue PagePinned；滚动权仍在 fill 内层（如 logs-page__scroll）。
 */
export default function PagePinned({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn("page-pinned", className)}>{children}</Tag>;
}
