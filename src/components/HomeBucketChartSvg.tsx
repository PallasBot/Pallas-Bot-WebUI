import { useRef, useState } from "react";
import type { BucketBarPack } from "@/utils/homePluginChartPack";
import { cn } from "@/lib/utils";

export default function HomeBucketChartSvg({
  pack,
  formatTime,
}: {
  pack: BucketBarPack;
  formatTime?: (sec: number) => string;
}) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [tooltipY, setTooltipY] = useState(0);
  const [tooltipBelow, setTooltipBelow] = useState(false);

  const slotW = pack.timesSec.length > 0 ? pack.innerW / pack.timesSec.length : 0;

  const hoverTime = hoverIndex != null ? pack.timesSec[hoverIndex] ?? null : null;
  const hoverRows =
    hoverIndex != null
      ? pack.series
          .map((s) => ({ label: s.label, color: s.color, value: s.vals[hoverIndex] ?? 0 }))
          .filter((r) => r.value > 0)
      : [];
  const hoverX = hoverIndex != null ? pack.left + (hoverIndex + 0.5) * slotW : null;

  function formatTimeLabel(sec: number): string {
    if (formatTime) return formatTime(sec);
    const d = new Date(sec * 1000);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function onPlotMove(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const wrap = plotRef.current;
    if (!svg || !wrap || !pack.timesSec.length) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const idx = Math.floor((svgPt.x - pack.left) / Math.max(1, slotW));
    setHoverIndex(Math.max(0, Math.min(pack.timesSec.length - 1, idx)));
    const rect = wrap.getBoundingClientRect();
    const pad = 12;
    setTooltipX(Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left)));
    const relativeY = ev.clientY - rect.top;
    const below = relativeY < 96;
    setTooltipY(below ? Math.min(rect.height - pad, relativeY + 8) : Math.max(pad, relativeY - 8));
    setTooltipBelow(below);
  }

  return (
    <div
      ref={plotRef}
      className="home-plugin-bucket-chart home-plugin-bucket-chart--interactive"
      onPointerMove={onPlotMove}
      onPointerLeave={() => setHoverIndex(null)}
    >
      <svg
        ref={svgRef}
        className="home-plugin-bucket-chart__svg home-plugin-bucket__svg"
        viewBox={`0 0 ${pack.W} ${pack.H}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="hidden"
        role="img"
        aria-label="时间桶柱状图"
      >
        {pack.gridYs.map((gy, gi) => (
          <line
            key={`bg-${gi}`}
            className="home-plugin-bucket__grid"
            x1={pack.left}
            y1={gy}
            x2={pack.left + pack.innerW}
            y2={gy}
          />
        ))}
        <line
          className="home-plugin-bucket__axis"
          x1={pack.left}
          y1={pack.bottom}
          x2={pack.left + pack.innerW}
          y2={pack.bottom}
        />
        {pack.yTicks.map((tk, ti) => (
          <text key={`byt-${ti}`} className="home-plugin-bucket__ytick" x={4} y={tk.y + 4}>
            {tk.t}
          </text>
        ))}
        {pack.xTicks.map((xk, xi) => (
          <text key={`bxt-${xi}`} className="home-plugin-bucket__xtick" textAnchor="middle" x={xk.x} y={pack.H - 6}>
            {xk.t}
          </text>
        ))}
        {pack.bars.map((b, bi) => (
          <rect
            key={`bb-${bi}`}
            className={cn("home-plugin-bucket__bar", hoverIndex != null && "home-plugin-bucket__bar--active")}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={2.5}
            fill={b.fill}
          />
        ))}
        {hoverX != null ? (
          <line
            className="home-plugin-bucket__cursor"
            x1={hoverX}
            y1={pack.top}
            x2={hoverX}
            y2={pack.bottom}
          />
        ) : null}
      </svg>
      {hoverTime != null && hoverRows.length ? (
        <div
          className={`home-plugin-chart-tooltip${tooltipBelow ? " home-plugin-chart-tooltip--below" : ""}`}
          style={{ left: `${tooltipX}px`, top: `${tooltipY}px` }}
          role="status"
        >
          <div className="home-plugin-chart-tooltip__hd">{formatTimeLabel(hoverTime)}</div>
          {hoverRows.map((r) => (
            <div key={r.label} className="home-plugin-chart-tooltip__row">
              <span className="home-plugin-chart-tooltip__dot" style={{ background: r.color }} aria-hidden="true" />
              <span className="home-plugin-chart-tooltip__label">{r.label}</span>
              <span className="home-plugin-chart-tooltip__val">{r.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type { BucketBarPack };
