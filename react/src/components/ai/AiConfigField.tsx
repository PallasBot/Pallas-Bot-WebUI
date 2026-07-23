import { useMemo, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** AI 配置字段：Label + 可选说明 + 控件。 */
export default function AiConfigField({
  label,
  htmlFor,
  description,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="space-y-0.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

const EMPTY = "__empty__";

/** 模型/枚举统一 shadcn Select（禁止原生 select / 自由文本模型框）。 */
export function AiModelSelect({
  value,
  onValueChange,
  options,
  placeholder = "选择模型",
  allowEmpty = true,
  emptyLabel = "（未指定）",
  disabled = false,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const opts = useMemo(() => {
    const set = new Set<string>();
    for (const m of options) {
      const t = (m || "").trim();
      if (t) set.add(t);
    }
    const cur = (value || "").trim();
    if (cur) set.add(cur);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [options, value]);

  return (
    <Select
      value={value.trim() ? value.trim() : allowEmpty ? EMPTY : undefined}
      onValueChange={(v) => onValueChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value={EMPTY}>{emptyLabel}</SelectItem> : null}
        {opts.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
