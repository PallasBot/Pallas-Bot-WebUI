import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__ai_option_empty__";

export type AiOptionSelectItem = {
  value: string;
  /** 主文案；默认用 value */
  label?: string;
  /** 次行说明（路径等） */
  description?: string;
};

function normalizeOptions(
  options: Array<string | AiOptionSelectItem>,
): AiOptionSelectItem[] {
  const seen = new Set<string>();
  const rows: AiOptionSelectItem[] = [];
  for (const raw of options) {
    const item = typeof raw === "string" ? { value: raw } : raw;
    const value = String(item.value || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    rows.push({
      value,
      label: (item.label || value).trim() || value,
      description: item.description?.trim() || undefined,
    });
  }
  return rows;
}

/**
 * 媒体等有限选项下拉（Speaker / 后端 / 参考音频）。
 * 不用模型发现 Popover，走普通 Select。
 */
export default function AiOptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "请选择",
  allowEmpty = true,
  emptyLabel = "（未指定）",
  disabled = false,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<string | AiOptionSelectItem>;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const rows = useMemo(() => normalizeOptions(options), [options]);
  const safeValue = (value || "").trim();
  const known = rows.some((row) => row.value === safeValue);
  const selectValue = safeValue
    ? safeValue
    : allowEmpty
      ? EMPTY_VALUE
      : (rows[0]?.value ?? EMPTY_VALUE);

  return (
    <Select
      value={selectValue}
      disabled={disabled}
      onValueChange={(next) => {
        onValueChange(next === EMPTY_VALUE ? "" : next);
      }}
    >
      <SelectTrigger className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? (
          <SelectItem value={EMPTY_VALUE}>{emptyLabel}</SelectItem>
        ) : null}
        {!known && safeValue ? (
          <SelectItem value={safeValue}>
            <span className="block min-w-0 truncate font-mono text-xs" title={safeValue}>
              {safeValue}
            </span>
          </SelectItem>
        ) : null}
        {rows.map((row) => (
          <SelectItem key={row.value} value={row.value} textValue={row.label || row.value}>
            <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
              <span className="truncate text-sm leading-tight">{row.label || row.value}</span>
              {row.description && row.description !== row.label ? (
                <span
                  className="truncate font-mono text-[11px] leading-tight text-muted-foreground"
                  title={row.description}
                >
                  {row.description}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
        {!rows.length && !safeValue ? (
          <SelectItem value="__ai_option_none__" disabled>
            暂无可选项
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
