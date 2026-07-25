import { formatCompactNumber, type TokenRow } from "@/utils/aiTaskStats";
import { fixedChartPalette } from "@/utils/chartTheme";
import { cn } from "@/lib/utils";

/**
 * 占比列表（水平条）。一边倒的分布比甜甜圈可读，名称始终可见。
 */
export default function TokenShareBars({
  rows,
  limit = 8,
  emptyText = "暂无数据",
  className,
}: {
  rows: TokenRow[];
  limit?: number;
  emptyText?: string;
  className?: string;
}) {
  const top = rows.slice(0, limit);
  const total = top.reduce((s, r) => s + r.totalTokens, 0);
  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  const palette = fixedChartPalette(Math.max(top.length, 8));

  return (
    <ul className={cn("space-y-2.5", className)}>
      {top.map((row, i) => {
        const pct = (row.totalTokens / total) * 100;
        const label = row.key.trim() || "未命名";
        return (
          <li key={`${label}-${i}`} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium" title={label}>
                {label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCompactNumber(row.totalTokens)}
                <span className="ml-1.5 text-[11px]">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.min(100, Math.max(pct, pct > 0 ? 1.5 : 0))}%`,
                  backgroundColor: palette[i % palette.length],
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
