import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ChartsPluginFilterOption = {
  id: string;
  label: string;
  runsToday: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ChartsPluginFilterOption[];
  selected: Set<string>;
  mode: "auto" | "custom";
  onToggle: (id: string, checked: boolean) => void;
  onSelectTop: (n: number) => void;
  onResetAuto: () => void;
  /** 嵌在图表面板内：弱化外框，避免再叠一层卡片感 */
  embedded?: boolean;
};

/** 可折叠：点选要上图的插件。 */
export default function ChartsPluginFilter({
  open,
  onOpenChange,
  options,
  selected,
  mode,
  onToggle,
  onSelectTop,
  onResetAuto,
  embedded = false,
}: Props) {
  const selectedCount = options.filter((o) => selected.has(o.id)).length;
  const summary =
    mode === "auto" ? "自动 Top" : selectedCount ? `已选 ${selectedCount}` : "未选（将回退自动）";

  return (
    <div
      className={cn(
        "charts-plugin-filter",
        embedded
          ? "rounded-md bg-muted/25"
          : "rounded-md border border-border/70 bg-muted/20",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-medium text-foreground"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex-1">展示插件</span>
        <span className="text-muted-foreground">{summary}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/50 px-2.5 py-2">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onSelectTop(6)}>
              Top 6
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onSelectTop(12)}>
              Top 12
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onResetAuto}>
              恢复自动
            </Button>
          </div>
          <ul className="m-0 grid max-h-44 list-none grid-cols-1 gap-1 overflow-y-auto p-0 sm:grid-cols-2">
            {options.map((opt) => {
              const checked = selected.has(opt.id);
              const inputId = `charts-plugin-filter-${opt.id}`;
              return (
                <li key={opt.id} className="min-w-0">
                  <label
                    htmlFor={inputId}
                    className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                    title={opt.label}
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={(v) => onToggle(opt.id, v === true)}
                    />
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{opt.runsToday}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {!options.length ? <p className="text-xs text-muted-foreground">暂无可选插件</p> : null}
        </div>
      ) : null}
    </div>
  );
}
