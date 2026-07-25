import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 段头：图标 + 标题 + lead；可选右侧操作（如总开关）。 */
export default function AiSectionHeader({
  icon: Icon,
  title,
  lead,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-bold leading-tight">
          {Icon ? <Icon className="size-5 shrink-0 text-primary" aria-hidden /> : null}
          <span className="min-w-0">{title}</span>
        </h2>
        {lead ? <p className="text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </div>
  );
}
