import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FIELD_LABEL =
  "inline-flex shrink-0 items-center gap-1 text-sm font-medium leading-none text-muted-foreground";
const FIELD_ICO = "size-3.5 shrink-0 opacity-80";

/** 工具条字段：可选 Lucide 图标 + 文案 + 控件。 */
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
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <Label className={FIELD_LABEL}>
        {Icon ? <Icon className={FIELD_ICO} strokeWidth={2} aria-hidden /> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

/** SelectItem / 触发器内选项文案：单色 Lucide + 文字。 */
export function ChromeOptionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className={FIELD_ICO} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}
