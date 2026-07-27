import {
  catmullStrokePath,
  fmtAxisCount,
  fmtAxisTick,
  linearAreaBandPath,
  linearAreaPath,
  pickTickIndices,
} from "@/utils/gsTrendChart";
import { fixedChartPalette } from "@/utils/chartTheme";
import { softBucketAxisMax } from "@/utils/homePluginChartPack";

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
  stacked: boolean;
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
  opts?: {
    maxSeries?: number;
    maxSlots?: number;
    axisUnit?: string;
    /** 半栏卡片：更接近 2:1，避免宽 viewBox 在窄容器里缩得看不清 */
    compact?: boolean;
    /** 保留全 0 序列（命中率等百分比图需要） */
    keepZeroSeries?: boolean;
    /** 按序列自下而上堆叠面积 */
    stacked?: boolean;
  },
): NamedSeriesTrendPack | null {
  const maxSeries = opts?.maxSeries ?? 12;
  const maxSlots = opts?.maxSlots ?? 56;
  const axisUnit = opts?.axisUnit ?? "次";
  const compact = Boolean(opts?.compact);
  const keepZeroSeries = Boolean(opts?.keepZeroSeries);
  const stacked = Boolean(opts?.stacked);
  const ranked = [...rows]
    .map((r) => ({
      ...r,
      sum: r.points.reduce((s, p) => s + (Number(p.total) || 0), 0),
    }))
    .filter((r) => r.points.length > 0 && (keepZeroSeries || r.sum > 0))
    .sort((a, b) => b.sum - a.sum || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, maxSeries);
  if (!ranked.length) return null;
  // 堆叠时自下而上：用量小的先画底层
  if (stacked) ranked.reverse();

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

  const cumVals: number[][] = seriesVals.map((vals) => vals.map(() => 0));
  for (let ti = 0; ti < timesSec.length; ti++) {
    let running = 0;
    for (let si = 0; si < seriesVals.length; si++) {
      running += seriesVals[si]![ti] ?? 0;
      cumVals[si]![ti] = running;
    }
  }

  const flat = stacked ? cumVals.flat() : seriesVals.flat();
  const { rawMax, scaleMax } = softBucketAxisMax(flat);
  const yMax = Math.max(1, scaleMax);
  const axisTopPlus = rawMax > yMax;
  const W = compact ? 640 : 960;
  const H = compact ? 320 : 260;
  const padL = compact ? 48 : 56;
  const padR = 16;
  const padT = 16;
  const padB = compact ? 40 : 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const top = padT;
  const bottom = padT + innerH;
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => bottom - t * innerH);
  const n = timesSec.length;
  const xAt = (i: number) => left + (i / (n - 1)) * innerW;
  const yAt = (v: number) => bottom - (Math.min(v, yMax) / yMax) * innerH;

  const series = ranked.map((r, si) => {
    const def: NamedSeriesTrendDef = {
      id: r.id,
      label: r.label,
      color: palette[stacked ? ranked.length - 1 - si : si]!,
    };
    const values = seriesVals[si]!;
    const tops = (stacked ? cumVals[si]! : values).map((v, i) => ({
      x: xAt(i),
      y: yAt(v),
      value: values[i] ?? 0,
    }));
    const bottoms = stacked
      ? si === 0
        ? tops.map((p) => ({ x: p.x, y: bottom }))
        : cumVals[si - 1]!.map((v, i) => ({ x: xAt(i), y: yAt(v) }))
      : null;
    return {
      def,
      values,
      points: tops,
      pathD: catmullStrokePath(tops),
      areaD: bottoms ? linearAreaBandPath(tops, bottoms) : linearAreaPath(tops, bottom),
    };
  });

  const yTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH * 0.25, t: fmtAxisTick(yMax * 0.25, axisUnit) },
    { y: bottom - innerH / 2, t: fmtAxisTick(yMax / 2, axisUnit) },
    { y: bottom - innerH * 0.75, t: fmtAxisTick(yMax * 0.75, axisUnit) },
    { y: top, t: axisTopPlus ? `${fmtAxisTick(yMax, axisUnit)}+` : fmtAxisTick(yMax, axisUnit) },
  ];
  const xTicks = pickTickIndices(n, compact ? 6 : 12).map((i) => ({
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
    stacked,
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
