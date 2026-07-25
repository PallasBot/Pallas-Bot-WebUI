import { useMemo, useState } from "react";
import { formatCompactNumber, type TokenRow } from "@/utils/aiTaskStats";
import { fixedChartPalette } from "@/utils/chartTheme";
import { cn } from "@/lib/utils";

type Slice = {
  key: string;
  value: number;
  color: string;
  percent: number;
  /** SVG path for donut arc */
  d: string;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.001) return "";
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, startDeg);
  const o1 = polar(cx, cy, rOuter, endDeg);
  const i1 = polar(cx, cy, rInner, endDeg);
  const i0 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

/**
 * Token 分布环形饼图（左环右图例，hover 高亮）。
 */
export default function TokenDonutChart({
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
  const [active, setActive] = useState<string | null>(null);

  const slices = useMemo(() => {
    const top = rows.slice(0, limit);
    const total = top.reduce((s, r) => s + r.totalTokens, 0);
    if (total <= 0) return [] as Slice[];
    const palette = fixedChartPalette(Math.max(top.length, 8));
    const cx = 100;
    const cy = 100;
    const rOuter = 72;
    const rInner = 44;
    let cursor = 0;
    return top.map((row, i) => {
      const value = row.totalTokens;
      const portion = (value / total) * 360;
      // 单片占满时画完整环（避免起止点重合 path 为空）
      let d: string;
      if (portion >= 359.99) {
        d = [
          `M ${cx} ${cy - rOuter}`,
          `A ${rOuter} ${rOuter} 0 1 1 ${cx - 0.01} ${cy - rOuter}`,
          `L ${cx - 0.01} ${cy - rInner}`,
          `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner}`,
          "Z",
        ].join(" ");
      } else {
        d = donutArc(cx, cy, rOuter, rInner, cursor, cursor + Math.max(portion, 0.4));
      }
      const slice: Slice = {
        key: row.key,
        value,
        color: palette[i % palette.length]!,
        percent: (value / total) * 100,
        d,
      };
      cursor += portion;
      return slice;
    });
  }, [limit, rows]);

  if (!slices.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const activeSlice = slices.find((s) => s.key === active) ?? null;

  return (
    <div className={cn("flex min-h-[240px] flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative mx-auto size-[13rem] shrink-0 sm:mx-0">
        <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="token 分布">
          {slices.map((s) => {
            const isActive = active === s.key;
            const dimmed = active != null && !isActive;
            return (
              <path
                key={s.key}
                d={s.d}
                fill={s.color}
                opacity={dimmed ? 0.35 : 1}
                className="cursor-pointer transition-opacity"
                style={{
                  transformOrigin: "100px 100px",
                  transform: isActive ? "scale(1.04)" : undefined,
                  filter: isActive ? "drop-shadow(0 2px 4px rgba(0,0,0,0.18))" : undefined,
                }}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
          {activeSlice ? (
            <>
              <div
                className="line-clamp-2 w-full text-xs font-medium leading-tight"
                title={activeSlice.key}
              >
                {activeSlice.key}
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatCompactNumber(activeSlice.value)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {activeSlice.percent.toFixed(1)}%
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground">合计</div>
              <div className="text-sm font-semibold tabular-nums">
                {formatCompactNumber(slices.reduce((s, x) => s + x.value, 0))}
              </div>
            </>
          )}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => {
          const isActive = active === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
                  isActive ? "bg-accent/60" : "hover:bg-accent/30",
                )}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
              >
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate" title={s.key}>
                  {s.key}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCompactNumber(s.value)}
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                  {s.percent.toFixed(0)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
