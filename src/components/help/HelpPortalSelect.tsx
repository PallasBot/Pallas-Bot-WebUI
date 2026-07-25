/**
 * 帮助图配置用 Portal 选择器：可选列表项，也可手输自定义值。
 * 与 AI 配置的 AiModelSelect 无关。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type HelpPortalOption = {
  value: string;
  /** 展示文案；缺省用 value */
  label?: string;
};

function uniqueOptions(items: HelpPortalOption[]): HelpPortalOption[] {
  const seen = new Set<string>();
  const out: HelpPortalOption[] = [];
  for (const raw of items) {
    const value = String(raw.value || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const label = String(raw.label || value).trim() || value;
    out.push({ value, label });
  }
  return out;
}

export function HelpField({
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

export default function HelpPortalSelect({
  value,
  onValueChange,
  options,
  placeholder = "请选择",
  inputPlaceholder = "输入后按 Enter 确认",
  allowEmpty = false,
  emptyLabel = "（未指定）",
  allowCustom = true,
  disabled = false,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: HelpPortalOption[];
  placeholder?: string;
  inputPlaceholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** 是否允许手输不在列表中的值 */
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => uniqueOptions(options), [options]);
  const safeValue = (value || "").trim();
  const selected = rows.find((r) => r.value === safeValue);
  const triggerText = safeValue ? selected?.label || safeValue : "";

  const lower = draft.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!lower) return rows;
    return rows.filter(
      (r) =>
        r.value.toLowerCase().includes(lower) ||
        (r.label || r.value).toLowerCase().includes(lower),
    );
  }, [lower, rows]);

  useEffect(() => {
    if (!open) {
      setDraft("");
      return;
    }
    setDraft("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commit = useCallback(
    (next: string) => {
      onValueChange(next.trim());
      setOpen(false);
    },
    [onValueChange],
  );

  const commitDraft = useCallback(() => {
    if (!allowCustom) return;
    const next = draft.trim();
    if (!next) return;
    commit(next);
  }, [allowCustom, commit, draft]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between px-3 font-normal", className)}
        >
          <span className={cn("min-w-0 truncate", !triggerText && "text-muted-foreground")}>
            {triggerText || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        {allowCustom ? (
          <div className="border-b p-2">
            <Input
              ref={inputRef}
              value={draft}
              disabled={disabled}
              placeholder={inputPlaceholder}
              className="h-9"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                }
              }}
            />
          </div>
        ) : null}

        <div className="max-h-[240px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
          {allowEmpty ? (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                !safeValue && "bg-accent text-accent-foreground",
              )}
              onClick={() => commit("")}
            >
              <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
              {!safeValue ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
            </button>
          ) : null}

          {filtered.length ? (
            filtered.map((row) => {
              const selectedRow = safeValue === row.value;
              return (
                <button
                  key={row.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    selectedRow && "bg-accent",
                  )}
                  onClick={() => commit(row.value)}
                >
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {row.label !== row.value ? (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {row.value}
                    </span>
                  ) : null}
                  {selectedRow ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          ) : lower && allowCustom ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">无匹配项，按 Enter 使用「{draft.trim()}」</p>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">暂无可选项</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
