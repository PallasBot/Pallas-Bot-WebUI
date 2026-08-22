import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/** 与 SelectTrigger 视觉对齐，供 Combobox 触发器复用。 */
export const COMBOBOX_TRIGGER_CLASS =
  "flex h-9 min-h-[var(--ui-ctrl-height,36px)] w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-[var(--control-bg,hsl(var(--ui-background)))] px-3 py-0 text-[length:var(--console-control-font-size,14px)] font-normal leading-snug text-[var(--text)] shadow-[var(--control-shadow)] focus:outline-none focus:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] focus:ring-0 focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)] data-[state=open]:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] data-[state=open]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export type ComboboxOption = {
  value: string;
  /** 触发器与列表展示 */
  label: React.ReactNode;
  /** 触发器单独展示（可选；默认用 label） */
  triggerLabel?: React.ReactNode;
  /** 过滤用纯文本；默认同 value */
  keywords?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  /** 选项数 ≥ 此值时显示搜索框；默认 8 */
  searchThreshold?: number;
  /** 参与阈值判断的数量；默认 `options.length`（Bot 选择可传账号数，不含「全部」等前置项） */
  searchCount?: number;
  /** 允许在搜索框 Enter 提交不在列表中的值（群号等） */
  allowCustom?: boolean;
  /** 列表加载中（打开后显示转圈，与镜像选择一致） */
  loading?: boolean;
  loadingText?: string;
  triggerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  id?: string;
  /** 持久化最近一次选择；仅对需要记忆的场景显式启用。 */
  memoryKey?: string;
};

function optionSearchText(opt: ComboboxOption): string {
  const labelText = typeof opt.label === "string" ? opt.label : "";
  return `${opt.value} ${opt.keywords?.trim() || ""} ${labelText}`.toLowerCase();
}

/**
 * 可搜索下拉。关闭时不挂载列表；过滤用简单 includes，避免 cmdk 默认模糊匹配卡顿。
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "请选择…",
  emptyText = "无匹配",
  searchPlaceholder = "搜索…",
  searchThreshold = 8,
  searchCount,
  allowCustom = false,
  loading = false,
  loadingText = "正在加载…",
  triggerClassName,
  contentClassName,
  ariaLabel,
  title,
  disabled,
  id,
  memoryKey,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const showSearch = allowCustom || (searchCount ?? options.length) >= searchThreshold;
  const selected = options.find((o) => o.value === value);
  const triggerBody = selected
    ? (selected.triggerLabel ?? selected.label)
    : value.trim()
      ? value
      : null;

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => optionSearchText(opt).includes(q));
  }, [options, query]);

  React.useEffect(() => {
    const key = memoryKey?.trim();
    if (!key || loading || typeof window === "undefined") return;

    try {
      const currentValue = value.trim();
      if (currentValue) {
        window.localStorage.setItem(key, currentValue);
        return;
      }

      const rememberedValue = window.localStorage.getItem(key)?.trim();
      if (!rememberedValue) return;
      if (allowCustom || options.some((option) => option.value === rememberedValue)) {
        onValueChange(rememberedValue);
      }
    } catch {
      // Storage can be unavailable in private browsing or restricted embeds.
    }
  }, [allowCustom, loading, memoryKey, onValueChange, options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-busy={loading || undefined}
          aria-label={ariaLabel}
          title={title}
          disabled={disabled}
          className={cn(COMBOBOX_TRIGGER_CLASS, triggerClassName)}
        >
          <span
            className={cn(
              "grid h-full min-w-0 flex-1 items-center overflow-x-hidden overflow-y-visible text-left leading-snug whitespace-nowrap text-ellipsis",
              !triggerBody && "text-[var(--console-placeholder-color)]",
            )}
          >
            {triggerBody ?? placeholder}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 self-center opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={8}
        className={cn(
          "flex max-h-[min(var(--radix-popover-content-available-height,100dvh),calc(100dvh-1rem))] w-auto min-w-[var(--radix-popover-trigger-width)] max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0",
          contentClassName,
        )}
      >
        <Command shouldFilter={false}>
          {showSearch && !loading ? (
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !allowCustom) return;
                if (filtered.some((option) => !option.disabled)) return;
                const next = query.trim();
                if (!next) return;
                e.preventDefault();
                onValueChange(next);
                setOpen(false);
              }}
            />
          ) : null}
          <CommandList>
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                {loadingText}
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {allowCustom && query.trim()
                    ? "无匹配；按 Enter 使用输入值"
                    : emptyText}
                </CommandEmpty>
                <CommandGroup>
                  {filtered.map((opt) => {
                    const selectedNow = opt.value === value;
                    return (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.disabled}
                        onSelect={() => {
                          onValueChange(opt.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 text-[var(--accent)]",
                            selectedNow ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
