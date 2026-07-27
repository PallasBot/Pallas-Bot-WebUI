import type { ConsoleDailyStatRow } from "@/api/pallasTypes";

export type GsTrendSeriesId = "sent" | "received" | "matcher" | "api";

export interface GsTrendSeriesDef {
  id: GsTrendSeriesId;
  label: string;
  color: string;
  axis: "left" | "right";
  unit: string;
}

export const GS_TREND_SERIES: GsTrendSeriesDef[] = [
  { id: "sent", label: "发送消息", color: "#6366f1", axis: "left", unit: "条" },
  { id: "received", label: "接收消息", color: "#a78bfa", axis: "left", unit: "条" },
  { id: "matcher", label: "Matcher", color: "#7c3aed", axis: "right", unit: "次" },
  { id: "api", label: "协议 API", color: "#ec4899", axis: "right", unit: "次" },
];

export function fmtAxisCount(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (x >= 10_000) return `${(x / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  if (x >= 1000) return `${(x / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

export function fmtAxisTick(n: number, unit: string): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return "0";
  return `${fmtAxisCount(x)}${unit}`;
}

export function catmullStrokePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1]! : pts[0]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = i + 2 < pts.length ? pts[i + 2]! : p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function linearAreaPath(pts: { x: number; y: number }[], bottomY: number): string {
  if (!pts.length) return "";
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  let d = `M ${first.x} ${bottomY} L ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i]!.x} ${pts[i]!.y}`;
  }
  d += ` L ${last.x} ${bottomY} Z`;
  return d;
}

/** 堆叠面积：上沿 top、下沿 bottom（同序点）。 */
export function linearAreaBandPath(
  top: { x: number; y: number }[],
  bottom: { x: number; y: number }[],
): string {
  if (!top.length || top.length !== bottom.length) return "";
  const first = top[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < top.length; i++) {
    d += ` L ${top[i]!.x} ${top[i]!.y}`;
  }
  for (let i = bottom.length - 1; i >= 0; i--) {
    d += ` L ${bottom[i]!.x} ${bottom[i]!.y}`;
  }
  d += " Z";
  return d;
}

export function pickTickIndices(n: number, maxTicks: number): number[] {
  if (n <= 0) return [];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [0];
  const step = (n - 1) / (maxTicks - 1);
  for (let k = 1; k < maxTicks - 1; k++) {
    out.push(Math.min(n - 1, Math.round(k * step)));
  }
  out.push(n - 1);
  return [...new Set(out)].sort((a, b) => a - b);
}

function seriesValue(row: ConsoleDailyStatRow, id: GsTrendSeriesId): number {
  if (id === "sent") return Number(row.sent) || 0;
  if (id === "received") return Number(row.received) || 0;
  if (id === "matcher") return Number(row.matcher_runs) || 0;
  return Number(row.api_calls) || 0;
}

export interface GsTrendChartPoint {
  x: number;
  y: number;
  value: number;
}

export interface GsTrendChartSeriesPack {
  def: GsTrendSeriesDef;
  values: number[];
  points: GsTrendChartPoint[];
  pathD: string;
  areaD: string;
}

export interface GsTrendChartPack {
  mode: "line";
  W: number;
  H: number;
  left: number;
  top: number;
  bottom: number;
  innerW: number;
  innerH: number;
  gridYs: number[];
  rows: ConsoleDailyStatRow[];
  series: GsTrendChartSeriesPack[];
  leftTicks: { y: number; t: string }[];
  rightTicks: { y: number; t: string }[];
  xTicks: { x: number; t: string }[];
  xAt: (i: number) => number;
}

export function buildGsTrendChartPack(rows: ConsoleDailyStatRow[]): GsTrendChartPack | null {
  const raw = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (raw.length < 2) return null;

  const activeDefs = GS_TREND_SERIES.filter((def) => {
    if (def.id !== "api") return true;
    return raw.some((r) => (Number(r.api_calls) || 0) > 0);
  });

  const hasData = raw.some((r) => activeDefs.some((def) => seriesValue(r, def.id) > 0));
  if (!hasData) return null;

  const W = 960;
  const H = 260;
  const padL = 48;
  const padR = 48;
  const padT = 28;
  const padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const top = padT;
  const bottom = padT + innerH;
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => bottom - t * innerH);
  const n = raw.length;
  const xAt = (i: number) => left + (i / (n - 1)) * innerW;

  const leftMax = Math.max(
    1,
    ...raw.flatMap((r) => [Number(r.sent) || 0, Number(r.received) || 0]),
  );
  const rightMax = Math.max(
    1,
    ...raw.flatMap((r) => {
      const vals = [Number(r.matcher_runs) || 0];
      if (activeDefs.some((d) => d.id === "api")) vals.push(Number(r.api_calls) || 0);
      return vals;
    }),
  );

  const yLeft = (v: number) => bottom - (v / leftMax) * innerH;
  const yRight = (v: number) => bottom - (v / rightMax) * innerH;

  const series: GsTrendChartSeriesPack[] = activeDefs.map((def) => {
    const values = raw.map((r) => seriesValue(r, def.id));
    const yFn = def.axis === "left" ? yLeft : yRight;
    const points = values.map((v, i) => ({ x: xAt(i), y: yFn(v), value: v }));
    return {
      def,
      values,
      points,
      pathD: catmullStrokePath(points),
      areaD: linearAreaPath(points, bottom),
    };
  });

  const leftTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH * 0.25, t: fmtAxisTick(leftMax * 0.25, "条") },
    { y: bottom - innerH / 2, t: fmtAxisTick(leftMax / 2, "条") },
    { y: bottom - innerH * 0.75, t: fmtAxisTick(leftMax * 0.75, "条") },
    { y: top, t: fmtAxisTick(leftMax, "条") },
  ];
  const rightTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH * 0.25, t: fmtAxisTick(rightMax * 0.25, "次") },
    { y: bottom - innerH / 2, t: fmtAxisTick(rightMax / 2, "次") },
    { y: bottom - innerH * 0.75, t: fmtAxisTick(rightMax * 0.75, "次") },
    { y: top, t: fmtAxisTick(rightMax, "次") },
  ];
  const xi = pickTickIndices(n, 14);
  const xTicks = xi.map((i) => ({
    x: xAt(i),
    t: raw[i]!.date.length >= 10 ? raw[i]!.date.slice(5) : raw[i]!.date,
  }));

  return {
    mode: "line",
    W,
    H,
    left,
    top,
    bottom,
    innerW,
    innerH,
    gridYs,
    rows: raw,
    series,
    leftTicks,
    rightTicks,
    xTicks,
    xAt,
  };
}

export function gsTrendHoverIndex(clientX: number, rect: DOMRect, pack: GsTrendChartPack): number {
  const relX = clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, relX / rect.width));
  const plotX = pack.left + ratio * pack.innerW;
  const n = pack.rows.length;
  if (n <= 1) return 0;
  const idx = Math.round(((plotX - pack.left) / pack.innerW) * (n - 1));
  return Math.max(0, Math.min(n - 1, idx));
}
