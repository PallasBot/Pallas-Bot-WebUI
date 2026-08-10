import { useRef, useState, type PointerEvent } from "react";
import type { IngressPressurePoint } from "@/utils/ingressDispatchHistory";

const ROWS: Array<{ key: keyof Omit<IngressPressurePoint, "at">; label: string; color: string; suffix?: string }> = [
  { key: "ingressP95", label: "入站 P95", color: "#ef4444", suffix: " ms" },
  { key: "schedulerWaitP95", label: "调度等待", color: "#a855f7", suffix: " ms" },
  { key: "queue", label: "排队", color: "#f97316" },
  { key: "concurrency", label: "并发", color: "#2563eb", suffix: "%" },
  { key: "learnEnqueued", label: "学习入队", color: "#10b981" },
  { key: "work", label: "后台", color: "#06b6d4" },
];

function formatPressureValue(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export default function IngressPressureStrips({ points }: { points: IngressPressurePoint[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<{
    row: (typeof ROWS)[number];
    point: IngressPressurePoint;
    value: number;
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const recent = points.slice(-96);
  const maxima = Object.fromEntries(
    ROWS.map((row) => [row.key, Math.max(1, ...recent.map((point) => point[row.key]))]),
  ) as Record<(typeof ROWS)[number]["key"], number>;

  if (!recent.length) return <p className="muted charts-page__section-note">尚未积累入站历史样本。</p>;

  function showTooltip(
    event: PointerEvent<HTMLElement>,
    row: (typeof ROWS)[number],
    point: IngressPressurePoint,
  ) {
    const hostRect = hostRef.current?.getBoundingClientRect();
    if (!hostRect) return;
    const cellRect = event.currentTarget.getBoundingClientRect();
    const cellTop = cellRect.top - hostRect.top;
    const below = cellTop < 52;
    setHovered({
      row,
      point,
      value: point[row.key],
      x: Math.max(16, Math.min(hostRect.width - 16, event.clientX - hostRect.left)),
      y: below ? cellRect.bottom - hostRect.top + 6 : cellTop - 6,
      below,
    });
  }

  return (
    <div
      ref={hostRef}
      className="ingress-pressure"
      role="group"
      aria-label="近期调度压力条带"
      onPointerLeave={() => setHovered(null)}
    >
      {ROWS.map((row) => (
        <div key={row.key} className="ingress-pressure__row">
          <span className="ingress-pressure__label">{row.label}</span>
          <div
            className="ingress-pressure__cells"
            style={{ gridTemplateColumns: `repeat(${recent.length}, minmax(1px, 1fr))` }}
          >
            {recent.map((point) => {
              const value = point[row.key];
              const ratio = Math.min(1, value / maxima[row.key]);
              return (
                <i
                  key={`${row.key}-${point.at}`}
                  className="ingress-pressure__cell"
                  onPointerEnter={(event) => showTooltip(event, row, point)}
                  style={{ backgroundColor: row.color, opacity: 0.24 + ratio * 0.76 }}
                />
              );
            })}
          </div>
          <strong>{recent.at(-1)?.[row.key] ?? 0}{row.suffix ?? ""}</strong>
        </div>
      ))}
      {hovered ? (
        <div
          className={`ingress-pressure__tooltip${hovered.below ? " ingress-pressure__tooltip--below" : ""}`}
          style={{ left: `${hovered.x}px`, top: `${hovered.y}px` }}
          role="status"
        >
          <span>{new Date(hovered.point.at * 1000).toLocaleString("zh-CN")}</span>
          <strong>{hovered.row.label} {formatPressureValue(hovered.value)}{hovered.row.suffix ?? ""}</strong>
        </div>
      ) : null}
    </div>
  );
}
