import { pickTickIndices } from "@/utils/gsTrendChart";
import { readChartPalette } from "@/utils/chartTheme";

export type BucketBarSeries = { label: string; color: string; vals: number[] };

export type BucketBarPack = {
  W: number;
  H: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  innerW: number;
  innerH: number;
  left: number;
  top: number;
  bottom: number;
  maxV: number;
  timesSec: number[];
  series: BucketBarSeries[];
  gridYs: number[];
  yTicks: { y: number; t: string }[];
  xTicks: { x: number; t: string }[];
  bars: { x: number; y: number; w: number; h: number; fill: string }[];
};

export type HourlyChartLayer = { label: string; color: string; poly: string; hours?: number[] };

export type HourlyChartPack = {
  W: number;
  H: number;
  left: number;
  bottom: number;
  innerW: number;
  gridYs: number[];
  yTicks: { y: number; t: string }[];
  layers: HourlyChartLayer[];
};

function fmtAxisCountTick(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (x >= 10_000) return `${(x / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  if (x >= 1000) return `${(x / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function fmtBucketAxisTime(sec: number): string {
  const d = new Date(sec * 1000);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day0 = localDayStartSec();
  if (sec >= day0 && sec < day0 + 86400) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function localDayStartSec(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function softBucketAxisMax(vals: number[]): { rawMax: number; scaleMax: number } {
  let rawMax = 1;
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) rawMax = Math.max(rawMax, n);
  }
  const positives = vals.filter((v) => Number(v) > 0).sort((a, b) => a - b);
  if (positives.length < 4 || rawMax <= 8) return { rawMax, scaleMax: rawMax };
  const idx88 = Math.floor(0.88 * (positives.length - 1));
  const idx95 = Math.floor(0.95 * (positives.length - 1));
  const p88 = positives[idx88]!;
  const p95 = positives[idx95]!;
  if (rawMax <= p95 * 3) return { rawMax, scaleMax: rawMax };
  const soft = Math.max(Math.ceil(p88 * 2.15), Math.ceil(p95 * 1.85), Math.ceil(rawMax * 0.18), 8);
  const scaleMax = Math.min(rawMax, soft);
  if (scaleMax >= rawMax * 0.97) return { rawMax, scaleMax: rawMax };
  return { rawMax, scaleMax };
}

export { softBucketAxisMax };

function downsampleBucketTimeline(
  timesSec: number[],
  series: BucketBarSeries[],
  maxSlots: number,
): { timesSec: number[]; series: BucketBarSeries[] } {
  if (timesSec.length <= maxSlots) return { timesSec, series };
  const chunk = Math.ceil(timesSec.length / maxSlots);
  const newTimes: number[] = [];
  const newSeries: BucketBarSeries[] = series.map((s) => ({
    label: s.label,
    color: s.color,
    vals: [] as number[],
  }));
  for (let i = 0; i < timesSec.length; i += chunk) {
    newTimes.push(timesSec[i]!);
    for (let si = 0; si < series.length; si++) {
      let sum = 0;
      const end = Math.min(i + chunk, timesSec.length);
      for (let j = i; j < end; j++) sum += series[si]!.vals[j] ?? 0;
      newSeries[si]!.vals.push(sum);
    }
  }
  return { timesSec: newTimes, series: newSeries };
}

export function chartSeriesColor(index: number): string {
  const palette = readChartPalette();
  return palette[index % palette.length] ?? palette[0] ?? "#a78bfa";
}

export function aggregateLocalToday(points: { at: number; total: number }[]): number[] {
  const bins = Array.from({ length: 24 }, () => 0);
  const t0 = localDayStartSec();
  const t1 = t0 + 86400;
  for (const p of points) {
    const a = Number(p.at);
    if (!Number.isFinite(a) || a < t0 || a >= t1) continue;
    const h = new Date(a * 1000).getHours();
    bins[h] += Number(p.total) || 0;
  }
  return bins;
}

export function buildBucketBarPack(
  rows: { label: string; points: { at: number; total: number }[] }[],
  narrowViewport: boolean,
  fmtTick: (n: number) => string = fmtAxisCountTick,
): BucketBarPack | null {
  if (!rows.length) return null;
  const timeSet = new Set<number>();
  for (const row of rows) {
    for (const p of row.points) {
      const t = Math.floor(Number(p.at));
      if (Number.isFinite(t)) timeSet.add(t);
    }
  }
  const timesSec = [...timeSet].sort((a, b) => a - b);
  if (!timesSec.length) return null;

  const valAt = (points: { at: number; total: number }[], t: number) => {
    const hit = points.find((p) => Math.floor(Number(p.at)) === t);
    return hit ? Number(hit.total) || 0 : 0;
  };

  const seriesRaw: BucketBarSeries[] = rows.map((row, i) => ({
    label: row.label,
    color: chartSeriesColor(i),
    vals: timesSec.map((t) => valAt(row.points, t)),
  }));

  const maxSlots = narrowViewport ? 40 : 56;
  const { timesSec: plotTimes, series } = downsampleBucketTimeline(timesSec, seriesRaw, maxSlots);

  const flatVals = series.flatMap((s) => s.vals);
  const { rawMax, scaleMax } = softBucketAxisMax(flatVals);
  const axisMax = scaleMax;
  const axisTopPlus = rawMax > scaleMax;

  const W = 440;
  const H = 212;
  const padL = 48;
  const padR = 12;
  const padT = 10;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const top = padT;
  const bottom = padT + innerH;

  const nT = plotTimes.length;
  const nS = series.length;
  const slotW = innerW / Math.max(1, nT);
  const bars: { x: number; y: number; w: number; h: number; fill: string }[] = [];

  const marginT = nT <= 3 ? 0.05 : narrowViewport ? 0.055 : 0.08;
  const barFill = narrowViewport ? 0.92 : 0.88;
  const barGapRatio = narrowViewport ? 0.04 : 0.06;
  const minBarW = narrowViewport ? 2.8 : 2;

  for (let i = 0; i < nT; i++) {
    const colL = left + i * slotW;
    const groupMargin = slotW * marginT;
    const innerCol = Math.max(0, slotW - 2 * groupMargin);
    const perSeries = nS > 0 ? innerCol / nS : innerCol;
    for (let s = 0; s < nS; s++) {
      const v = series[s]!.vals[i] ?? 0;
      if (v <= 0) continue;
      const bhRaw = Math.min(1, v / axisMax) * innerH;
      const bh = Math.max(bhRaw, 1.2);
      const barW = Math.max(minBarW, perSeries * barFill);
      const bx = colL + groupMargin + s * perSeries + perSeries * barGapRatio;
      const by = bottom - bh;
      if (barW <= 0 || bh <= 0) continue;
      bars.push({ x: bx, y: by, w: barW, h: bh, fill: series[s]!.color });
    }
  }

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((g) => bottom - g * innerH);
  const yTicks = [
    { y: bottom, t: fmtTick(0) },
    { y: bottom - innerH * 0.25, t: fmtTick(axisMax * 0.25) },
    { y: bottom - innerH / 2, t: fmtTick(axisMax / 2) },
    { y: bottom - innerH * 0.75, t: fmtTick(axisMax * 0.75) },
    { y: top, t: axisTopPlus ? `${fmtTick(axisMax)}+` : fmtTick(axisMax) },
  ];
  const maxXTicks = narrowViewport ? 5 : nT > 36 ? 6 : nT > 24 ? 7 : 8;
  const xi = pickTickIndices(nT, maxXTicks);
  const xTicks = xi.map((idx) => ({
    x: left + (idx + 0.5) * slotW,
    t: fmtBucketAxisTime(plotTimes[idx]!),
  }));

  return {
    W,
    H,
    padL,
    padR,
    padT,
    padB,
    innerW,
    innerH,
    left,
    top,
    bottom,
    maxV: rawMax,
    timesSec: plotTimes,
    series,
    gridYs,
    yTicks,
    xTicks,
    bars,
  };
}

export function buildHourlyChartPack(
  rows: { label: string; hours: number[] }[],
  fmtTick: (n: number) => string = fmtAxisCountTick,
): HourlyChartPack | null {
  if (!rows.length) return null;
  const flat = rows.flatMap((r) => r.hours);
  const { rawMax, scaleMax } = softBucketAxisMax(flat);
  const axisMax = scaleMax;
  const axisTopPlus = rawMax > scaleMax;

  const W = 440;
  const H = 200;
  const padL = 42;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const top = padT;
  const bottom = padT + innerH;

  const xAt = (h: number) => left + (h / 23) * innerW;
  const yAt = (v: number) => bottom - Math.min(1, v / axisMax) * innerH;

  const layers: HourlyChartLayer[] = rows.map((row, i) => ({
    label: row.label,
    color: chartSeriesColor(i),
    hours: row.hours,
    poly: row.hours.map((v, h) => `${xAt(h).toFixed(2)},${yAt(v).toFixed(2)}`).join(" "),
  }));

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((g) => bottom - g * innerH);
  const yTicks = [
    { y: bottom, t: fmtTick(0) },
    { y: bottom - innerH * 0.25, t: fmtTick(axisMax * 0.25) },
    { y: bottom - innerH / 2, t: fmtTick(axisMax / 2) },
    { y: bottom - innerH * 0.75, t: fmtTick(axisMax * 0.75) },
    { y: top, t: axisTopPlus ? `${fmtTick(axisMax)}+` : fmtTick(axisMax) },
  ];

  return { W, H, left, bottom, innerW, gridYs, yTicks, layers };
}

export function defaultTopKeys(
  keys: string[],
  pointsFor: (k: string) => { at: number; total: number }[],
  max: number,
): string[] {
  const scored = keys
    .map((k) => ({
      k,
      sum: pointsFor(k).reduce((s, p) => s + (Number(p.total) || 0), 0),
    }))
    .sort((a, b) => b.sum - a.sum);
  return scored.slice(0, max).map((x) => x.k);
}

export function rankBarWidthPercent(value: number, maxValue: number): number {
  const MIN = 32;
  if (value <= 0 || maxValue <= 0) return 0;
  const linearRatio = Math.min(1, value / maxValue);
  const curvedRatio = Math.sqrt(linearRatio);
  return Math.round(MIN + (100 - MIN) * curvedRatio);
}

export function fmtDurationMs(ms: number | null | undefined): string {
  const v = Number(ms);
  if (!Number.isFinite(v)) return "—";
  if (v < 0.01) return "<0.01ms";
  if (v < 1) return `${v.toFixed(2)}ms`;
  if (v < 1000) return `${Math.round(v * 10) / 10}ms`;
  return `${(v / 1000).toFixed(2)}s`;
}
