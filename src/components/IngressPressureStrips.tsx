import type { IngressPressurePoint } from "@/utils/ingressDispatchHistory";

const ROWS: Array<{ key: keyof Omit<IngressPressurePoint, "at">; label: string; color: string }> = [
  { key: "queue", label: "排队", color: "var(--destructive)" },
  { key: "concurrency", label: "并发", color: "var(--accent)" },
  { key: "work", label: "后台", color: "var(--amber-500, #f59e0b)" },
];

export default function IngressPressureStrips({ points }: { points: IngressPressurePoint[] }) {
  const recent = points.slice(-96);
  const maxima = Object.fromEntries(
    ROWS.map((row) => [row.key, Math.max(1, ...recent.map((point) => point[row.key]))]),
  ) as Record<(typeof ROWS)[number]["key"], number>;

  if (!recent.length) return <p className="muted charts-page__section-note">尚未积累入站历史样本。</p>;

  return (
    <div className="ingress-pressure" role="img" aria-label="近期调度压力条带">
      {ROWS.map((row) => (
        <div key={row.key} className="ingress-pressure__row">
          <span className="ingress-pressure__label">{row.label}</span>
          <div className="ingress-pressure__cells">
            {recent.map((point) => {
              const value = point[row.key];
              const ratio = Math.min(1, value / maxima[row.key]);
              return (
                <i
                  key={`${row.key}-${point.at}`}
                  className="ingress-pressure__cell"
                  title={`${new Date(point.at * 1000).toLocaleString()} ${row.label} ${row.key === "concurrency" ? `${value}%` : value}`}
                  style={{ backgroundColor: row.color, opacity: 0.14 + ratio * 0.86 }}
                />
              );
            })}
          </div>
          <strong>{recent.at(-1)?.[row.key] ?? 0}{row.key === "concurrency" ? "%" : ""}</strong>
        </div>
      ))}
    </div>
  );
}
