import {
  catmullStrokePath,
  fmtAxisCount,
  fmtAxisTick,
  linearAreaPath,
  pickTickIndices,
} from "@/utils/gsTrendChart";
import { fixedChartPalette } from "@/utils/chartTheme";

export type NamedSeriesPoint = { at: number; total: number };

export type NamedSeriesInput = {
  id: string;
  label: string;
  points: NamedSeriesPoint[];
};

export type NamedSeriesTrendDef = {
  id: string;
  label: string;
  color: string;
};

export type NamedSeriesTrendPack = {
  W: number;
  H: number;
  left: number;
  top: number;
  bottom: number;
  innerW: number;
  innerH: number;
  gridYs: number[];
  timesSec: number[];
  series: {
    def: NamedSeriesTrendDef;
    values: number[];
    points: { x: number; y: number; value: number }[];
    pathD: string;
    areaD: string;
  }[];
  yTicks: { y: number; t: string }[];
  xTicks: { x: number; t: string }[];
  xAt: (i: number) => number;
};

function fmtBucketTime(sec: number): string {
  const d = new Date(sec * 1000);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day0 = new Date();
  day0.setHours(0, 0, 0, 0);
  const t0 = Math.floor(day0.getTime() / 1000);
  if (sec >= t0 && sec < t0 + 86400) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function downsample(
  timesSec: number[],
  seriesVals: number[][],
  maxSlots: number,
): { timesSec: number[]; seriesVals: number[][] } {
  if (timesSec.length <= maxSlots) return { timesSec, seriesVals };
  const chunk = Math.ceil(timesSec.length / maxSlots);
  const newTimes: number[] = [];
  const newSeries = seriesVals.map(() => [] as number[]);
  for (let i = 0; i < timesSec.length; i += chunk) {
    newTimes.push(timesSec[i]!);
    const end = Math.min(i + chunk, timesSec.length);
    for (let si = 0; si < seriesVals.length; si++) {
      let sum = 0;
      for (let j = i; j < end; j++) sum += seriesVals[si]![j] ?? 0;
      newSeries[si]!.push(sum);
    }
  }
  return { timesSec: newTimes, seriesVals: newSeries };
}

/** 多条命名时序 → 与区间趋势同构的单轴折线 pack */
export function buildNamedSeriesTrendPack(
  rows: NamedSeriesInput[],
  opts?: { maxSeries?: number; maxSlots?: number },
): NamedSeriesTrendPack | null {
  const maxSeries = opts?.maxSeries ?? 6;
  const maxSlots = opts?.maxSlots ?? 56;
  const ranked = [...rows]
    .map((r) => ({
      ...r,
      sum: r.points.reduce((s, p) => s + (Number(p.total) || 0), 0),
    }))
    .filter((r) => r.sum > 0 && r.points.length > 0)
    .sort((a, b) => b.sum - a.sum || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, maxSeries);
  if (!ranked.length) return null;

  const timeSet = new Set<number>();
  for (const row of ranked) {
    for (const p of row.points) {
      const t = Math.floor(Number(p.at));
      if (Number.isFinite(t)) timeSet.add(t);
    }
  }
  const timesRaw = [...timeSet].sort((a, b) => a - b);
  if (timesRaw.length < 2) return null;

  const palette = fixedChartPalette(ranked.length);
  const valAt = (points: NamedSeriesPoint[], t: number) => {
    const hit = points.find((p) => Math.floor(Number(p.at)) === t);
    return hit ? Number(hit.total) || 0 : 0;
  };
  const seriesValsRaw = ranked.map((r) => timesRaw.map((t) => valAt(r.points, t)));
  const { timesSec, seriesVals } = downsample(timesRaw, seriesValsRaw, maxSlots);
  if (timesSec.length < 2) return null;

  const yMax = Math.max(1, ...seriesVals.flat());
  const W = 960;
  const H = 260;
  const padL = 48;
  const padR = 20;
  const padT = 28;
  const padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const top = padT;
  const bottom = padT + innerH;
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => bottom - t * innerH);
  const n = timesSec.length;
  const xAt = (i: number) => left + (i / (n - 1)) * innerW;
  const yAt = (v: number) => bottom - (v / yMax) * innerH;

  const series = ranked.map((r, si) => {
    const def: NamedSeriesTrendDef = {
      id: r.id,
      label: r.label,
      color: palette[si]!,
    };
    const values = seriesVals[si]!;
    const points = values.map((v, i) => ({ x: xAt(i), y: yAt(v), value: v }));
    return {
      def,
      values,
      points,
      pathD: catmullStrokePath(points),
      areaD: linearAreaPath(points, bottom),
    };
  });

  const yTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH * 0.25, t: fmtAxisTick(yMax * 0.25, "次") },
    { y: bottom - innerH / 2, t: fmtAxisTick(yMax / 2, "次") },
    { y: bottom - innerH * 0.75, t: fmtAxisTick(yMax * 0.75, "次") },
    { y: top, t: fmtAxisTick(yMax, "次") },
  ];
  const xTicks = pickTickIndices(n, 12).map((i) => ({
    x: xAt(i),
    t: fmtBucketTime(timesSec[i]!),
  }));

  return {
    W,
    H,
    left,
    top,
    bottom,
    innerW,
    innerH,
    gridYs,
    timesSec,
    series,
    yTicks,
    xTicks,
    xAt,
  };
}

export function fmtNamedSeriesHoverTime(sec: number): string {
  return fmtBucketTime(sec);
}

export { fmtAxisCount };
