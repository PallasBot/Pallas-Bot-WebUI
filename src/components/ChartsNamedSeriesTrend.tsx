import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import { useChartTooltipPin } from "@/hooks/useChartTooltipPin";
import { cn } from "@/lib/utils";
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
  const [animKey, setAnimKey] = useState(0);
  const pin = useChartTooltipPin({ belowThreshold: 96 });

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
    pin.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- series change resets tooltip
  }, [series]);

  const summaryTotal = useMemo(
    () => series.reduce((s, row) => s + row.points.reduce((a, p) => a + (Number(p.total) || 0), 0), 0),
    [series],
  );

  const hoverTime = pin.index != null && pack ? pack.timesSec[pin.index] ?? null : null;
  const hoverX = pin.index != null && pack ? pack.xAt(pin.index) : null;

  const resolveIndex = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const p = pack;
      if (!svg || !p) return 0;
      const ctm = svg.getScreenCTM();
      if (!ctm) return 0;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());
      const ratio = (svgPt.x - p.left) / p.innerW;
      return Math.max(
        0,
        Math.min(p.timesSec.length - 1, Math.round(ratio * (p.timesSec.length - 1))),
      );
    },
    [pack],
  );

  const onPlotMove = useCallback(
    (ev: React.PointerEvent) => {
      pin.handlePointerMove(ev, resolveIndex, plotRef.current);
    },
    [pin, resolveIndex],
  );

  const onPlotClick = useCallback(
    (ev: React.MouseEvent) => {
      pin.handleClick(ev, resolveIndex, plotRef.current);
    },
    [pin, resolveIndex],
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
            ref={(node) => {
              plotRef.current = node;
              pin.attachWrap(node);
            }}
            className={cn("gs-trend-chart__plot", pin.pinned && "gs-trend-chart__plot--pinned")}
            onPointerMove={onPlotMove}
            onPointerLeave={pin.handlePointerLeave}
            onClick={onPlotClick}
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
              {pack.dualAxis
                ? pack.yTicksRight.map((tk, ti) => (
                    <text
                      key={`ytr-${ti}`}
                      className="gs-trend-chart__axis gs-trend-chart__axis--right"
                      x={pack.W - 8}
                      y={tk.y + 4}
                    >
                      {tk.t}
                    </text>
                  ))
                : null}
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

              {pin.index != null ? (
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
                    r={pin.index === di ? 6 : 4}
                    fill={s.def.color}
                    stroke={pin.index === di ? "var(--bg-card, #fff)" : "transparent"}
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

            {hoverTime != null && pin.index != null ? (
              <div
                className={`gs-trend-chart__tooltip${pin.below ? " gs-trend-chart__tooltip--below" : ""}${pin.pinned ? " gs-trend-chart__tooltip--pinned" : ""}`}
                style={{ left: `${pin.tooltipX}px`, top: `${pin.tooltipY}px` }}
                role="status"
              >
                <div className="gs-trend-chart__tooltip-date">{fmtNamedSeriesHoverTime(hoverTime)}</div>
                {pack.series
                  .map((s) => ({
                    id: s.def.id,
                    label: s.def.label,
                    color: s.def.color,
                    value: s.values[pin.index ?? 0] ?? 0,
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
                {pack.dualAxis ? (
                  <span className="gs-trend-chart__leg-axis">
                    {s.def.axis === "right" ? "右轴" : "左轴"}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
