import { useMemo } from "react";
import { softBucketAxisMax } from "@/utils/homePluginChartPack";

export type ChartsRankBarPoint = {
  label: string;
  value: number;
  fullLabel?: string;
};

function fmtTick(v: number): string {
  const n = Math.max(0, v);
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** 横向排行：名称固定栏宽截断；可选软缩放避免头部一飞冲天。 */
export default function ChartsHorizontalRankBars({
  points,
  unit = "",
  accent = "#7c3aed",
  emptyText = "暂无数据",
  maxRows = 12,
  softScale = false,
}: {
  points: ChartsRankBarPoint[];
  unit?: string;
  accent?: string;
  emptyText?: string;
  maxRows?: number;
  softScale?: boolean;
}) {
  const rows = useMemo(() => {
    return [...points]
      .filter((p) => (Number(p.value) || 0) > 0 && String(p.label || "").trim())
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, maxRows);
  }, [maxRows, points]);

  const values = rows.map((r) => r.value);
  const { rawMax, scaleMax } = softScale ? softBucketAxisMax(values) : { rawMax: Math.max(1, ...values, 1), scaleMax: Math.max(1, ...values, 1) };
  const maxV = Math.max(1, scaleMax);
  const soft = softScale && rawMax > maxV;

  if (!rows.length) {
    return <p className="muted charts-page__section-note">{emptyText}</p>;
  }

  return (
    <ul className="charts-rank-bars m-0 flex list-none flex-col gap-1.5 p-0">
      {rows.map((row) => {
        const pct = Math.max(2, Math.round((100 * Math.min(row.value, maxV)) / maxV));
        const title = row.fullLabel || row.label;
        const capped = soft && row.value > maxV;
        return (
          <li
            key={row.label}
            className="charts-rank-bars__row grid min-w-0 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]"
          >
            <span
              className="min-w-0 truncate text-xs font-medium text-foreground"
              title={title}
            >
              {row.label}
            </span>
            <div
              className="h-2 min-w-0 overflow-hidden rounded-full bg-muted/70"
              title={`${title}: ${row.value}${unit}`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%`, background: accent }}
              />
            </div>
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
              {fmtTick(row.value)}
              {unit}
              {capped ? "+" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
