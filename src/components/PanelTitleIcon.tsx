import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 面板标题前缀图标：多段并列时帮扫读；对齐 AI 配置段头。 */
export default function PanelTitleIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={cn("size-4 shrink-0 text-primary", className)} aria-hidden />;
}
