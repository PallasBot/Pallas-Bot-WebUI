import { formatSharePercent } from "@/utils/shareDistribution";
import AiProgressBar from "@/components/ai/AiProgressBar";
import { formatCompactNumber, type TokenRow } from "@/utils/aiTaskStats";
import { fixedChartPalette } from "@/utils/chartTheme";
import { cn } from "@/lib/utils";

/**
 * 占比列表（水平条）。一边倒 / 多类目时比甜甜圈可读，名称始终可见。
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
                <span className="ml-1.5 text-[11px]">{formatSharePercent(pct)}</span>
              </span>
            </div>
            <AiProgressBar value={pct} color={palette[i % palette.length]} ariaLabel={`${label} 占比`} />
          </li>
        );
      })}
    </ul>
  );
}
