import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ConsoleDailyStatRow } from "@/api/pallasTypes";
import {
  buildGsTrendChartPack,
  fmtAxisCount,
  type GsTrendSeriesId,
} from "@/utils/gsTrendChart";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import "@/styles/gs-trend-chart.css";

type Props = {
  rows: ConsoleDailyStatRow[];
  emptyText?: string;
  busy?: boolean;
  showSummary?: boolean;
  chartUid?: string;
  className?: string;
};

function rowValue(row: ConsoleDailyStatRow, key: GsTrendSeriesId): number {
  if (key === "sent") return Number(row.sent) || 0;
  if (key === "received") return Number(row.received) || 0;
  if (key === "matcher") return Number(row.matcher_runs) || 0;
  return Number(row.api_calls) || 0;
}

function fmtDateLabel(date: string): string {
  if (date.length >= 10) return date.slice(5);
  return date;
}

export default function GsDualAxisTrendChart({
  rows,
  emptyText = "暂无持久化数据，请保持 Bot 运行并跨日写入。",
  busy = false,
  showSummary = true,
  chartUid = "",
  className,
}: Props) {
  const autoId = useId().replace(/:/g, "");
  const uid = chartUid || `gs-trend-${autoId}`;
  const plotRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [tooltipY, setTooltipY] = useState(0);
  const [tooltipBelow, setTooltipBelow] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const pack = useMemo(() => buildGsTrendChartPack(rows), [rows]);

  useEffect(() => {
    setAnimKey((k) => k + 1);
    setHoverIndex(null);
  }, [rows]);

  const monthSummary = useMemo(() => {
    let sent = 0;
    let received = 0;
    let matcher = 0;
    let api = 0;
    for (const row of rows) {
      sent += Number(row.sent) || 0;
      received += Number(row.received) || 0;
      matcher += Number(row.matcher_runs) || 0;
      api += Number(row.api_calls) || 0;
    }
    return { sent, received, matcher, api };
  }, [rows]);

  const hoverRow = hoverIndex != null && pack ? pack.rows[hoverIndex] ?? null : null;
  const hoverX = hoverIndex != null && pack ? pack.xAt(hoverIndex) : null;

  const onPlotMove = useCallback(
    (ev: React.PointerEvent) => {
      const svg = svgRef.current;
      const p = pack;
      const wrap = plotRef.current;
      if (!svg || !p || !wrap) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());
      const ratio = (svgPt.x - p.left) / p.innerW;
      const idx = Math.max(0, Math.min(p.rows.length - 1, Math.round(ratio * (p.rows.length - 1))));
      setHoverIndex((prev) => (prev === idx ? prev : idx));
      const rect = wrap.getBoundingClientRect();
      const pad = 12;
      const nextX = Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left));
      const relativeY = ev.clientY - rect.top;
      const below = relativeY < 96;
      const nextY = below ? Math.min(rect.height - pad, relativeY + 8) : Math.max(pad, relativeY - 8);
      setTooltipX((prev) => (Math.abs(prev - nextX) < 0.5 ? prev : nextX));
      setTooltipY((prev) => (Math.abs(prev - nextY) < 0.5 ? prev : nextY));
      setTooltipBelow((prev) => (prev === below ? prev : below));
    },
    [pack],
  );

  return (
    <div className={["gs-trend-chart", className].filter(Boolean).join(" ")}>
      {showSummary &&
      (monthSummary.sent > 0 || monthSummary.received > 0 || monthSummary.matcher > 0) ? (
        <div className="gs-trend-chart__summary muted">
          <span>发送 {monthSummary.sent.toLocaleString()} 条</span>
          <span>接收 {monthSummary.received.toLocaleString()} 条</span>
          <span>Matcher {monthSummary.matcher.toLocaleString()} 次</span>
          {monthSummary.api > 0 ? <span>API {monthSummary.api.toLocaleString()} 次</span> : null}
        </div>
      ) : null}

      {busy && !pack ? (
        <ConsoleBlockSkeleton lines={5} label="趋势图加载中" className="gs-trend-chart__empty" />
      ) : !pack ? (
        <p className="muted gs-trend-chart__empty">{emptyText}</p>
      ) : (
        <>
          <div
            ref={plotRef}
            className="gs-trend-chart__plot"
            onPointerMove={onPlotMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <svg
              ref={svgRef}
              className="gs-trend-chart__svg"
              viewBox={`0 0 ${pack.W} ${pack.H}`}
              preserveAspectRatio="xMidYMid meet"
              overflow="visible"
              role="img"
              aria-label={`消息与 Matcher 按日趋势，共 ${pack.rows.length} 天`}
            >
              <defs>
                {pack.series.map((s) => (
                  <linearGradient
                    key={`${uid}-grad-${s.def.id}`}
                    id={`${uid}-area-${s.def.id}`}
                    gradientUnits="userSpaceOnUse"
                    x1={pack.left}
                    y1={pack.bottom}
                    x2={pack.left}
                    y2={pack.top}
                  >
                    <stop offset="0%" stopColor={s.def.color} stopOpacity={0} />
                    <stop offset="100%" stopColor={s.def.color} stopOpacity={0.16} />
                  </linearGradient>
                ))}
              </defs>

              {pack.gridYs.map((gy, gi) => (
                <line
                  key={`g-${gi}`}
                  className="gs-trend-chart__grid"
                  x1={pack.left}
                  y1={gy}
                  x2={pack.left + pack.innerW}
                  y2={gy}
                />
              ))}

              {pack.leftTicks.map((tk, ti) => (
                <text key={`lt-${ti}`} className="gs-trend-chart__axis gs-trend-chart__axis--left" x={8} y={tk.y + 4}>
                  {tk.t}
                </text>
              ))}
              {pack.rightTicks.map((tk, ti) => (
                <text
                  key={`rt-${ti}`}
                  className="gs-trend-chart__axis gs-trend-chart__axis--right"
                  x={pack.W - 8}
                  y={tk.y + 4}
                >
                  {tk.t}
                </text>
              ))}
              {pack.xTicks.map((xt, xi) => (
                <text
                  key={`xt-${xi}`}
                  className="gs-trend-chart__axis gs-trend-chart__axis--x"
                  x={xt.x}
                  y={pack.H - 10}
                >
                  {xt.t}
                </text>
              ))}

              {pack.series.map((s) => (
                <path
                  key={`${uid}-area-${s.def.id}-${animKey}`}
                  className="gs-trend-chart__area"
                  d={s.areaD}
                  fill={`url(#${uid}-area-${s.def.id})`}
                  style={{ ["--gs-series-color" as string]: s.def.color }}
                />
              ))}

              {pack.series.map((s) => (
                <path
                  key={`${uid}-line-${s.def.id}-${animKey}`}
                  className="gs-trend-chart__line gs-trend-chart__line--animate"
                  d={s.pathD}
                  fill="none"
                  stroke={s.def.color}
                />
              ))}

              {hoverIndex != null ? (
                <line
                  className="gs-trend-chart__crosshair"
                  x1={hoverX ?? 0}
                  y1={pack.top}
                  x2={hoverX ?? 0}
                  y2={pack.bottom}
                />
              ) : null}

              {pack.series.map((s) =>
                s.points.map((p, di) => (
                  <circle
                    key={`${s.def.id}-${di}`}
                    className="gs-trend-chart__dot"
                    style={hoverIndex === di ? { r: 6 } : undefined}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIndex === di ? 6 : 4}
                    fill={s.def.color}
                    stroke={hoverIndex === di ? "var(--panel, #fff)" : "transparent"}
                    strokeWidth={2}
                  />
                )),
              )}

              <rect
                className="gs-trend-chart__hit"
                x={pack.left}
                y={pack.top}
                width={pack.innerW}
                height={pack.innerH}
                fill="transparent"
              />
            </svg>

            {hoverRow && hoverIndex != null ? (
              <div
                className={`gs-trend-chart__tooltip${tooltipBelow ? " gs-trend-chart__tooltip--below" : ""}`}
                style={{ left: `${tooltipX}px`, top: `${tooltipY}px` }}
                role="status"
              >
                <div className="gs-trend-chart__tooltip-date">{fmtDateLabel(hoverRow.date)}</div>
                {pack.series.map((s) => (
                  <div key={`tip-${s.def.id}`} className="gs-trend-chart__tooltip-row">
                    <i className="gs-trend-chart__tooltip-dot" style={{ background: s.def.color }} aria-hidden="true" />
                    <span className="gs-trend-chart__tooltip-label">{s.def.label}</span>
                    <span className="gs-trend-chart__tooltip-val">
                      {fmtAxisCount(rowValue(hoverRow, s.def.id))}
                      {s.def.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="gs-trend-chart__legend muted">
            {pack.series.map((s) => (
              <span key={`leg-${s.def.id}`} className="gs-trend-chart__leg-item">
                <i className="gs-trend-chart__leg-swatch" style={{ background: s.def.color }} aria-hidden="true" />
                {s.def.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
