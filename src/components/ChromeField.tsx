import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FIELD_LABEL =
  "inline-flex shrink-0 items-center gap-1 text-sm font-medium leading-none text-muted-foreground";
const FIELD_ICO = "size-3.5 shrink-0 opacity-80";

/** 工具条字段：可选 Lucide 图标 + 文案 + 控件（簇距与 chrome-tools 统一）。 */
export default function ChromeField({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("chrome-tools__field flex shrink-0 items-center", className)}>
      <Label className={FIELD_LABEL}>
        {Icon ? <Icon className={FIELD_ICO} strokeWidth={2} aria-hidden /> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

/** SelectItem / 触发器内选项文案：单色 Lucide + 文字（须 flex 对齐，勿靠文字基线） */
export function ChromeOptionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 leading-[1.25]">
      <Icon className={cn(FIELD_ICO, "block")} strokeWidth={2} aria-hidden />
      {/* 勿用 leading-none + truncate：CJK 字形易被纵向裁切 */}
      <span className="min-w-0 overflow-x-hidden text-ellipsis whitespace-nowrap leading-[1.25]">
        {children}
      </span>
    </span>
  );
}
