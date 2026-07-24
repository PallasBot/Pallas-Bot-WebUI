import { useRef, useState } from "react";
import type { HourlyChartPack } from "@/utils/homePluginChartPack";

const HOURLY_AXIS_HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HomeHourlyChartSvg({ pack }: { pack: HourlyChartPack }) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const hoverX = hoverHour != null ? pack.left + (hoverHour / 23) * pack.innerW : null;
  const hoverRows =
    hoverHour != null
      ? pack.layers
          .map((ly) => ({
            label: ly.label,
            color: ly.color,
            value: ly.hours?.[hoverHour] ?? 0,
          }))
          .filter((r) => r.value > 0)
      : [];

  function onPlotMove(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const wrap = plotRef.current;
    if (!svg || !wrap) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const ratio = (svgPt.x - pack.left) / Math.max(1, pack.innerW);
    setHoverHour(Math.max(0, Math.min(23, Math.round(ratio * 23))));
    const rect = wrap.getBoundingClientRect();
    const pad = 12;
    setTooltipX(Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left)));
  }

  return (
    <div
      ref={plotRef}
      className="home-plugin-hourly-chart home-plugin-hourly-chart--interactive"
      onPointerMove={onPlotMove}
      onPointerLeave={() => setHoverHour(null)}
    >
      <svg
        ref={svgRef}
        className="home-plugin-hourly-chart__svg"
        viewBox={`0 0 ${pack.W} ${pack.H}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="hidden"
        role="img"
        aria-label="今日各小时折线图"
      >
        {pack.gridYs.map((gy, gi) => (
          <line
            key={`hg-${gi}`}
            className="home-plugin-hourly__grid"
            x1={pack.left}
            y1={gy}
            x2={pack.left + pack.innerW}
            y2={gy}
          />
        ))}
        {pack.yTicks.map((tk, ti) => (
          <text key={`hyt-${ti}`} className="home-plugin-hourly__ytick" x={4} y={tk.y + 4}>
            {tk.t}
          </text>
        ))}
        {HOURLY_AXIS_HOURS.filter((h) => h % 3 === 0).map((h) => (
          <text
            key={`hxt-${h}`}
            className="home-plugin-hourly__xtick"
            textAnchor="middle"
            x={pack.left + (h / 23) * pack.innerW}
            y={pack.H - 6}
          >
            {h}
          </text>
        ))}
        {pack.layers.map((ly, idx) => (
          <polyline
            key={`hl-${idx}`}
            className="home-plugin-hourly__line"
            fill="none"
            stroke={ly.color}
            points={ly.poly}
          />
        ))}
        {hoverX != null ? (
          <line
            className="home-plugin-hourly__crosshair"
            x1={hoverX}
            y1={pack.gridYs[pack.gridYs.length - 1] ?? 0}
            x2={hoverX}
            y2={pack.bottom}
          />
        ) : null}
      </svg>
      {hoverHour != null && hoverRows.length ? (
        <div className="home-plugin-hourly-chart__tooltip" style={{ left: `${tooltipX}px` }} role="status">
          <div className="home-plugin-hourly-chart__tooltip-hour">{hoverHour}:00</div>
          {hoverRows.map((r) => (
            <div key={r.label} className="home-plugin-hourly-chart__tooltip-row">
              <i style={{ background: r.color }} aria-hidden="true" />
              <span>{r.label}</span>
              <strong>{r.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
