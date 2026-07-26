import { useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
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

function optionLabel(row: AiOptionSelectItem): ComboboxOption["label"] {
  const main = row.label || row.value;
  if (!row.description || row.description === main) {
    return <span className="block min-w-0 truncate">{main}</span>;
  }
  return (
    <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
      <span className="truncate text-sm leading-tight">{main}</span>
      <span
        className="truncate font-mono text-[11px] leading-tight text-muted-foreground"
        title={row.description}
      >
        {row.description}
      </span>
    </span>
  );
}

/**
 * 媒体等有限选项下拉（Speaker / 后端 / 参考音频 / Provider）。
 * 选项 ≥ 8 时显示搜索（Combobox）。
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
  searchThreshold = 8,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<string | AiOptionSelectItem>;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  searchThreshold?: number;
  ariaLabel?: string;
}) {
  const rows = useMemo(() => normalizeOptions(options), [options]);
  const safeValue = (value || "").trim();
  const known = rows.some((row) => row.value === safeValue);

  const comboboxOptions = useMemo(() => {
    const out: ComboboxOption[] = [];
    if (allowEmpty) {
      out.push({
        value: EMPTY_VALUE,
        label: emptyLabel,
        keywords: emptyLabel,
      });
    }
    if (!known && safeValue) {
      out.push({
        value: safeValue,
        label: (
          <span className="block min-w-0 truncate font-mono text-xs" title={safeValue}>
            {safeValue}
          </span>
        ),
        keywords: safeValue,
      });
    }
    for (const row of rows) {
      out.push({
        value: row.value,
        label: optionLabel(row),
        triggerLabel: row.label || row.value,
        keywords: [row.label || row.value, row.description || "", row.value].filter(Boolean).join(" "),
      });
    }
    if (!rows.length && !safeValue && !allowEmpty) {
      out.push({
        value: "__ai_option_none__",
        label: "暂无可选项",
        disabled: true,
        keywords: "暂无可选项",
      });
    }
    return out;
  }, [allowEmpty, emptyLabel, known, rows, safeValue]);

  const selectValue = safeValue
    ? safeValue
    : allowEmpty
      ? EMPTY_VALUE
      : (rows[0]?.value ?? EMPTY_VALUE);

  return (
    <Combobox
      value={selectValue}
      onValueChange={(next) => {
        if (next === "__ai_option_none__") return;
        onValueChange(next === EMPTY_VALUE ? "" : next);
      }}
      options={comboboxOptions}
      placeholder={placeholder}
      searchPlaceholder="搜索…"
      emptyText={rows.length ? "无匹配" : "暂无可选项"}
      searchThreshold={searchThreshold}
      searchCount={rows.length}
      disabled={disabled}
      ariaLabel={ariaLabel}
      triggerClassName={cn("h-9 w-full", className)}
      contentClassName="min-w-[var(--radix-popover-trigger-width)]"
    />
  );
}
