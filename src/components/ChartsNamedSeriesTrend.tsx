import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import "@/styles/gs-trend-chart.css";
import {
  buildNamedSeriesTrendPack,
  fmtAxisCount,
  fmtNamedSeriesHoverTime,
  type NamedSeriesInput,
} from "@/utils/namedSeriesTrend";

type Props = {
  series: NamedSeriesInput[];
  emptyText?: string;
  busy?: boolean;
  chartUid?: string;
  className?: string;
  showSummary?: boolean;
  /** Y 轴单位后缀；Token 用量传 ""，命中率传 "%" */
  axisUnit?: string;
  /** 半栏并排：更高 viewBox + 与 CSS 同比例，避免矮框里 meet 留白 */
  compact?: boolean;
  /** 图例与折线最多条数；默认跟 pack 一致（12） */
  maxSeries?: number;
  /** 保留全 0 序列（百分比趋势） */
  keepZeroSeries?: boolean;
  /** 自下而上堆叠面积 */
  stacked?: boolean;
};

/** 多序列折线趋势：视觉跟 GsDualAxisTrendChart / 区间趋势一致。 */
export default function ChartsNamedSeriesTrend({
  series,
  emptyText = "暂无时序数据。",
  busy = false,
  chartUid = "",
  className,
  showSummary = true,
  axisUnit = "次",
  compact = false,
  maxSeries = 12,
  keepZeroSeries = false,
  stacked = false,
}: Props) {
  const autoId = useId().replace(/:/g, "");
  const uid = chartUid || `named-trend-${autoId}`;
  const plotRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const pack = useMemo(
    () =>
      buildNamedSeriesTrendPack(series, {
        axisUnit,
        compact,
        maxSeries,
        keepZeroSeries,
        stacked,
      }),
    [axisUnit, compact, keepZeroSeries, maxSeries, series, stacked],
  );

  useEffect(() => {
    setAnimKey((k) => k + 1);
    setHoverIndex(null);
  }, [series]);

  const summaryTotal = useMemo(
    () => series.reduce((s, row) => s + row.points.reduce((a, p) => a + (Number(p.total) || 0), 0), 0),
    [series],
  );

  const hoverTime = hoverIndex != null && pack ? pack.timesSec[hoverIndex] ?? null : null;
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
      const idx = Math.max(
        0,
        Math.min(p.timesSec.length - 1, Math.round(ratio * (p.timesSec.length - 1))),
      );
      setHoverIndex((prev) => (prev === idx ? prev : idx));
      const rect = wrap.getBoundingClientRect();
      const pad = 12;
      const nextX = Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left));
      setTooltipX((prev) => (Math.abs(prev - nextX) < 0.5 ? prev : nextX));
    },
    [pack],
  );

  return (
    <div
      className={[
        "gs-trend-chart",
        compact ? "gs-trend-chart--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showSummary && summaryTotal > 0 ? (
        <div className="gs-trend-chart__summary muted">
          <span>合计 {summaryTotal.toLocaleString()} 次</span>
          <span>{series.filter((r) => r.points.some((p) => (p.total || 0) > 0)).length} 个插件</span>
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
              aria-label={`时序趋势，共 ${pack.timesSec.length} 个时间桶`}
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
                    <stop offset="0%" stopColor={s.def.color} stopOpacity={pack.stacked ? 0.22 : 0} />
                    <stop offset="100%" stopColor={s.def.color} stopOpacity={pack.stacked ? 0.55 : 0.16} />
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

              {pack.yTicks.map((tk, ti) => (
                <text key={`yt-${ti}`} className="gs-trend-chart__axis gs-trend-chart__axis--left" x={8} y={tk.y + 4}>
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

            {hoverTime != null && hoverIndex != null ? (
              <div className="gs-trend-chart__tooltip" style={{ left: `${tooltipX}px` }} role="status">
                <div className="gs-trend-chart__tooltip-date">{fmtNamedSeriesHoverTime(hoverTime)}</div>
                {pack.series
                  .map((s) => ({
                    id: s.def.id,
                    label: s.def.label,
                    color: s.def.color,
                    value: s.values[hoverIndex] ?? 0,
                  }))
                  .filter((r) => r.value > 0)
                  .map((r) => (
                    <div key={`tip-${r.id}`} className="gs-trend-chart__tooltip-row">
                      <i className="gs-trend-chart__tooltip-dot" style={{ background: r.color }} aria-hidden="true" />
                      <span className="gs-trend-chart__tooltip-label">{r.label}</span>
                      <span className="gs-trend-chart__tooltip-val">
                        {fmtAxisCount(r.value)}
                        {axisUnit}
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
