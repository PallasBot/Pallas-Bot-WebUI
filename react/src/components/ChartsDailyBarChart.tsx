import { useMemo, useRef, useState } from "react";

export type ChartsDailyBarPoint = {
  date: string;
  value: number;
  label?: string;
};

function fmtTick(v: number): string {
  const n = Math.max(0, v);
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function pickTickIndices(n: number, maxTicks: number): number[] {
  if (n <= 1) return [0];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [0];
  const step = (n - 1) / (maxTicks - 1);
  for (let k = 1; k < maxTicks - 1; k++) out.push(Math.min(n - 1, Math.round(k * step)));
  out.push(n - 1);
  return [...new Set(out)].sort((a, b) => a - b);
}

export default function ChartsDailyBarChart({
  points,
  title = "",
  unit = "",
  accent = "#ea580c",
  emptyText = "所选范围暂无持久化数据",
}: {
  points: ChartsDailyBarPoint[];
  title?: string;
  unit?: string;
  accent?: string;
  emptyText?: string;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const pack = useMemo(() => {
    const pts = points.filter((p) => p.date);
    if (!pts.length) return null;
    const values = pts.map((p) => Math.max(0, Number(p.value) || 0));
    const maxV = Math.max(...values, 1);
    const W = 640;
    const H = 220;
    const padL = 40;
    const padR = 12;
    const padT = 16;
    const padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const left = padL;
    const bottom = padT + innerH;
    const n = pts.length;
    const gap = n > 20 ? 3 : n > 14 ? 4 : 6;
    const barW = Math.max(5, (innerW - gap * (n - 1)) / n);
    const bars = pts.map((p, i) => {
      const v = Math.max(0, Number(p.value) || 0);
      const h = (v / maxV) * innerH;
      const x = left + i * (barW + gap);
      const dayLabel = p.label ?? (p.date.length >= 10 ? String(Number(p.date.slice(8, 10))) : p.date);
      return { x, y: bottom - h, w: barW, h, v, dayLabel, date: p.date, cx: x + barW / 2 };
    });
    const yTicks = [
      { y: bottom, t: "0" },
      { y: bottom - innerH * 0.25, t: fmtTick(maxV * 0.25) },
      { y: bottom - innerH * 0.5, t: fmtTick(maxV * 0.5) },
      { y: bottom - innerH * 0.75, t: fmtTick(maxV * 0.75) },
      { y: padT, t: fmtTick(maxV) },
    ];
    const xTicks = pickTickIndices(n, 12).map((i) => ({ x: bars[i]!.cx, t: bars[i]!.dayLabel }));
    return { W, H, left, bottom, bars, yTicks, xTicks, gap, barW };
  }, [points]);

  if (!pack) {
    return <p className="muted charts-page__section-note">{emptyText}</p>;
  }

  const chart = pack;
  const hoverBar = hoverIndex != null ? chart.bars[hoverIndex] : null;

  function onPlotMove(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const wrap = plotRef.current;
    if (!svg || !wrap || !chart.bars.length) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const idx = Math.floor((svgPt.x - chart.left) / (chart.barW + chart.gap));
    setHoverIndex(Math.max(0, Math.min(chart.bars.length - 1, idx)));
    const rect = wrap.getBoundingClientRect();
    setTooltipX(Math.max(12, Math.min(rect.width - 12, ev.clientX - rect.left)));
  }

  return (
    <div className="charts-daily-bar">
      {title ? <div className="charts-daily-bar__title">{title}</div> : null}
      <div
        ref={plotRef}
        className="charts-daily-bar__plot"
        onPointerMove={onPlotMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <svg ref={svgRef} viewBox={`0 0 ${chart.W} ${chart.H}`} className="charts-daily-bar__svg" role="img">
          {chart.yTicks.map((t) => (
            <g key={`y-${t.y}`}>
              <line x1={chart.left} x2={chart.W - 12} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth={1} />
              <text x={chart.left - 6} y={t.y + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {t.t}
              </text>
            </g>
          ))}
          {chart.bars.map((b, i) => (
            <rect
              key={b.date}
              x={b.x}
              y={b.y}
              width={b.w}
              height={Math.max(b.h, b.v > 0 ? 2 : 0)}
              rx={3}
              fill={accent}
              opacity={hoverIndex == null || hoverIndex === i ? 0.92 : 0.35}
            />
          ))}
          {chart.xTicks.map((t) => (
            <text key={`x-${t.x}`} x={t.x} y={chart.H - 10} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {t.t}
            </text>
          ))}
        </svg>
        {hoverBar ? (
          <div className="charts-daily-bar__tip" style={{ left: tooltipX }}>
            <div>{hoverBar.date}</div>
            <div>
              {hoverBar.v.toLocaleString()}
              {unit ? ` ${unit}` : ""}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
