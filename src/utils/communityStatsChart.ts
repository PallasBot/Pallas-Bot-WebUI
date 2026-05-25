/** SVG polyline points 字符串（至少 2 个点） */
export function buildTrendSparkPoints(
  values: number[],
  width = 440,
  height = 120,
  padding = 6,
): string | undefined {
  if (values.length < 2) return undefined;
  const w = Math.max(40, width);
  const h = Math.max(24, height);
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min || 1;
  const step = innerW / (values.length - 1);
  return values
    .map((v, i) => {
      const x = padding + i * step;
      const y = padding + innerH - ((v - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function formatHistoryBucketAt(atSec: number): string {
  const d = new Date(atSec * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDelta(cur: number, prev: number | undefined): string {
  if (prev === undefined) return "—";
  const d = cur - prev;
  if (d === 0) return "0";
  return d > 0 ? `+${d}` : String(d);
}
