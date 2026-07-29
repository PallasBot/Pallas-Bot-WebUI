import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import ConfigFieldHelp from "@/components/config/ConfigFieldHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** AI 配置字段：Label + 可选「?」说明 + 控件。 */
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
  const helpTitle = typeof label === "string" ? label : "说明";
  const stringDesc = typeof description === "string" ? description.trim() : "";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {stringDesc ? <ConfigFieldHelp title={helpTitle} description={stringDesc} /> : null}
      </div>
      {description && !stringDesc ? (
        <div className="text-xs text-muted-foreground">{description}</div>
      ) : null}
      {children}
    </div>
  );
}

type ModelTab = "preset" | "discovered";

function uniqueModels(...lists: Array<Iterable<string> | undefined>): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      const t = String(raw || "").trim();
      if (t) set.add(t);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * 模型选择：触发器 + 浮层；可手输，分「常用 / 模型发现」。
 * Enter 提交输入；点列表项选中。传入 onDiscover 后可在「模型发现」内刷新。
 */
export function AiModelSelect({
  value,
  onValueChange,
  options,
  presetOptions,
  isFetching = false,
  onDiscover,
  placeholder = "选择或输入模型",
  inputPlaceholder = "输入模型名，Enter 确认",
  allowEmpty = true,
  emptyLabel = "（未指定）",
  disabled = false,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** 模型发现列表（接口拉取 / 已知可选） */
  options: string[];
  /** 常用列表；未传时用当前已选值 */
  presetOptions?: string[];
  isFetching?: boolean;
  /** 刷新 / 拉取模型发现列表 */
  onDiscover?: () => void;
  placeholder?: string;
  inputPlaceholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ModelTab>("discovered");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autoDiscoverOnceRef = useRef(false);

  const safeValue = (value || "").trim();
  const discovered = useMemo(() => uniqueModels(options), [options]);
  const presets = useMemo(() => {
    if (presetOptions) return uniqueModels(presetOptions, safeValue ? [safeValue] : undefined);
    return uniqueModels(safeValue ? [safeValue] : undefined);
  }, [presetOptions, safeValue]);

  const lower = draft.trim().toLowerCase();
  const presetFiltered = useMemo(() => {
    if (!lower) return presets;
    return presets.filter((m) => m.toLowerCase().includes(lower));
  }, [lower, presets]);
  const discoveredFiltered = useMemo(() => {
    if (!lower) return discovered;
    return discovered.filter((m) => m.toLowerCase().includes(lower));
  }, [lower, discovered]);

  const canDiscover = Boolean(onDiscover);

  useEffect(() => {
    if (!open) {
      setDraft("");
      autoDiscoverOnceRef.current = false;
      return;
    }
    setDraft("");
    setTab(canDiscover || discovered.length || isFetching ? "discovered" : "preset");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, discovered.length, isFetching, canDiscover]);

  useEffect(() => {
    if (!open || tab !== "discovered" || !onDiscover || autoDiscoverOnceRef.current) return;
    autoDiscoverOnceRef.current = true;
    onDiscover();
  }, [open, tab, onDiscover]);

  const commit = useCallback(
    (next: string) => {
      onValueChange(next.trim());
      setOpen(false);
    },
    [onValueChange],
  );

  const commitDraft = useCallback(() => {
    const next = draft.trim();
    if (!next) return;
    commit(next);
  }, [commit, draft]);

  function renderRow(model: string) {
    const selected = safeValue === model;
    return (
      <button
        key={model}
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          selected && "bg-accent",
        )}
        onClick={() => commit(model)}
      >
        <span className="min-w-0 flex-1 truncate">{model}</span>
        {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
      </button>
    );
  }

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
          <span className={cn("truncate", !safeValue && "text-muted-foreground")}>
            {safeValue || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="space-y-2 border-b p-2">
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={tab === "preset" ? "secondary" : "ghost"}
              className={cn(
                "h-8 flex-1 text-xs",
                tab === "preset" ? "font-medium" : "text-muted-foreground",
              )}
              onClick={() => setTab("preset")}
            >
              常用
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "discovered" ? "secondary" : "ghost"}
              className={cn(
                "h-8 flex-1 gap-1 text-xs",
                tab === "discovered" ? "font-medium" : "text-muted-foreground",
              )}
              onClick={() => setTab("discovered")}
            >
              模型发现
              {isFetching ? <Loader2 className="size-3 animate-spin" /> : null}
            </Button>
          </div>
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

        <div className="h-[220px] overflow-hidden">
          <div
            className={cn("h-full overflow-y-auto", tab !== "preset" && "hidden")}
            onWheel={(e) => e.stopPropagation()}
          >
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
            {presetFiltered.length ? (
              presetFiltered.map(renderRow)
            ) : lower ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">无匹配项，按 Enter 使用当前输入</p>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">在上方输入模型名，或切换到「模型发现」</p>
            )}
          </div>

          <div
            className={cn("flex h-full flex-col", tab !== "discovered" && "hidden")}
            onWheel={(e) => e.stopPropagation()}
          >
            {onDiscover ? (
              <div className="flex shrink-0 items-center justify-end border-b px-2 py-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={disabled || isFetching}
                  onClick={() => onDiscover()}
                >
                  {isFetching ? <Loader2 className="size-3 animate-spin" /> : null}
                  {isFetching ? "发现中…" : "刷新列表"}
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isFetching && discovered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在发现模型…
                </div>
              ) : discovered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
                  <p>暂无发现结果</p>
                  <p className="text-xs">
                    {onDiscover ? "点上方「刷新列表」拉取，或直接输入模型名" : "可直接在上方输入模型名"}
                  </p>
                </div>
              ) : discoveredFiltered.length ? (
                discoveredFiltered.map(renderRow)
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">无匹配项，按 Enter 使用当前输入</p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
