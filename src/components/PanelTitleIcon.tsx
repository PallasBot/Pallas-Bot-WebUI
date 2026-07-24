import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 面板标题前缀图标：走 `.panel__title-ico`（彩色 accent / 黑白前景由 CSS 控制）。 */
export default function PanelTitleIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={cn("panel__title-ico", className)} aria-hidden />;
}
