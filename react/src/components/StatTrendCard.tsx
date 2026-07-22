import { useMemo } from "react";
import { buildSparkBars, buildSparkGeometry } from "@pallas-vue/utils/sparkline";

export default function StatTrendCard({
  label,
  value,
  hint,
  hintTitle,
  dense = false,
  sparkValues,
  chartMode = "line",
  chartVariant = "msg",
}: {
  label: string;
  value: string | number;
  hint?: string;
  hintTitle?: string;
  dense?: boolean;
  sparkValues?: number[];
  chartMode?: "line" | "bar";
  chartVariant?: "msg" | "api" | "matcher" | "ai";
}) {
  const hasChart = (sparkValues?.length ?? 0) >= 2;
  const lineGeom = useMemo(
    () => (chartMode === "line" && hasChart ? buildSparkGeometry(sparkValues ?? []) : undefined),
    [chartMode, hasChart, sparkValues],
  );
  const bars = useMemo(
    () =>
      chartMode === "bar" && (sparkValues?.length ?? 0) >= 1 ? buildSparkBars(sparkValues ?? []) : [],
    [chartMode, sparkValues],
  );

  return (
    <div
      className={[
        "ui-card ui-card--glass stat-trend-card",
        dense ? "stat-trend-card--dense" : "",
        lineGeom || bars.length ? "stat-trend-card--has-chart" : "",
        `stat-trend-card--${chartVariant}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="stat-trend-card__body">
        <div className="stat-trend-card__head">
          <div className="stat-trend-card__label">{label}</div>
          <div className="stat-trend-card__value">{value}</div>
        </div>
        {hint ? (
          <div className="stat-trend-card__hint" title={hintTitle || undefined}>
            {hint}
          </div>
        ) : null}
        {lineGeom ? (
          <svg
            className="stat-trend-card__chart stat-trend-card__chart--line"
            viewBox="0 0 160 48"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className="stat-trend-card__area" d={lineGeom.area} />
            <polyline className="stat-trend-card__line" points={lineGeom.poly} />
          </svg>
        ) : bars.length ? (
          <svg
            className="stat-trend-card__chart stat-trend-card__chart--bar"
            viewBox="0 0 160 48"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {bars.map((bar, i) => (
              <rect
                key={i}
                className="stat-trend-card__bar"
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                rx={1}
              />
            ))}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
