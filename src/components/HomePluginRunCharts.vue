<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type {
  ApiCallNamedSeries,
  ConsoleDailyStatRow,
  MatcherDurationLogEntry,
  MatcherErrorLogEntry,
  PluginMatcherNamedSeries,
  PluginRunStatsRow,
  PluginRow,
} from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { buildPluginRunSparkPoly, formatPluginRunSampleTime } from "@/utils/pluginRunHistory";
import { matcherPluginDisplayName } from "@/utils/pluginDisplayLabel";
import HomeBucketChartSvg, { type BucketBarPack, type BucketBarSeries } from "@/components/HomeBucketChartSvg.vue";
import HomeHourlyChartSvg, { type HourlyChartLayer, type HourlyChartPack } from "@/components/HomeHourlyChartSvg.vue";
import HomeChartPanelSkeleton from "@/components/HomeChartPanelSkeleton.vue";
import GsDualAxisTrendChart from "@/components/GsDualAxisTrendChart.vue";
import { installChartThemeWatcher, readChartPalette } from "@/utils/chartTheme";

/** 今日各小时图横轴刻度 0–23（本地自然日） — 见 HomeHourlyChartSvg */
const CHART_SEL_KEY = "pallas_home_chart_sel_v1";
const CHART_PANEL_KEY = "pallas_home_chart_panel_v1";

type ChartPanelId =
  | "matcher_duration_recent"
  | "matcher_duration_hist"
  | "matcher_duration_scatter"
  | "plugins_top"
  | "plugins_duration_top"
  | "daily_msg_matcher"
  | "api_hourly"
  | "api_bucket"
  | "matcher_hourly"
  | "matcher_bucket"
  | "matcher_duration_hourly"
  | "matcher_duration_bucket"
  | "matcher_err_hourly"
  | "matcher_err_bucket"
  | "local_spark";

const PANEL_LABELS: Record<ChartPanelId, string> = {
  matcher_duration_recent: "Matcher 单次耗时",
  matcher_duration_hist: "Matcher 耗时 · 分布",
  matcher_duration_scatter: "Matcher 耗时 · 散点",
  matcher_duration_hourly: "Matcher 耗时 · 今日各小时",
  matcher_duration_bucket: "Matcher 耗时 · 按时间桶",
  plugins_top: "插件今日次数",
  plugins_duration_top: "插件今日平均耗时",
  matcher_hourly: "Matcher · 今日各小时",
  matcher_bucket: "Matcher · 按时间桶",
  matcher_err_hourly: "Matcher 异常 · 今日各小时",
  matcher_err_bucket: "Matcher 异常 · 按时间桶",
  daily_msg_matcher: "消息 / Matcher（按日）",
  api_hourly: "协议 API · 今日各小时",
  api_bucket: "协议 API · 按时间桶",
  local_spark: "Matcher 累计（本机采样）",
};

/** 下拉分组与默认遍历顺序（细粒度耗时 → 运行统计 → 异常 → 汇总与其它） */
const PANEL_GROUPS: { label: string; panels: ChartPanelId[] }[] = [
  {
    label: "Matcher 耗时",
    panels: [
      "matcher_duration_recent",
      "matcher_duration_hist",
      "matcher_duration_scatter",
      "matcher_duration_hourly",
      "matcher_duration_bucket",
    ],
  },
  {
    label: "Matcher 运行",
    panels: ["plugins_top", "plugins_duration_top", "matcher_hourly", "matcher_bucket"],
  },
  {
    label: "Matcher 异常",
    panels: ["matcher_err_hourly", "matcher_err_bucket"],
  },
  {
    label: "汇总与其它",
    panels: ["daily_msg_matcher", "api_hourly", "api_bucket", "local_spark"],
  },
];

const PANEL_ORDER: ChartPanelId[] = PANEL_GROUPS.flatMap((g) => g.panels);

const DEFAULT_DASHBOARD_PANELS: ChartPanelId[] = [
  "daily_msg_matcher",
  "api_bucket",
  "matcher_bucket",
  "plugins_top",
  "matcher_duration_hourly",
  "matcher_err_bucket",
];

const DASHBOARD_PANEL_SPAN2 = new Set<ChartPanelId>(["daily_msg_matcher", "matcher_duration_hourly"]);

function isChartPanelId(s: string): s is ChartPanelId {
  return (PANEL_ORDER as string[]).includes(s);
}

function loadChartPanel(): ChartPanelId | null {
  try {
    const v = localStorage.getItem(CHART_PANEL_KEY);
    if (v && isChartPanelId(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

function saveChartPanel(id: ChartPanelId) {
  try {
    localStorage.setItem(CHART_PANEL_KEY, id);
  } catch {
    /* ignore */
  }
}

const CHART_DRAW_EXPANDED_KEY = "pallas_home_chart_draw_expanded_v1";

function loadChartsDrawExpanded(): boolean {
  try {
    const v = localStorage.getItem(CHART_DRAW_EXPANDED_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function saveChartsDrawExpanded(open: boolean) {
  try {
    localStorage.setItem(CHART_DRAW_EXPANDED_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const CHART_FILTER_EXPANDED_KEY = "pallas_home_chart_filter_expanded_v1";

function loadChartsFilterExpanded(): boolean {
  try {
    const v = localStorage.getItem(CHART_FILTER_EXPANDED_KEY);
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function saveChartsFilterExpanded(open: boolean) {
  try {
    localStorage.setItem(CHART_FILTER_EXPANDED_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type SelState = { api: string[]; matcher: string[]; matcherErr: string[]; durationRecent: string[] };

function loadSel(): SelState {
  try {
    const x = JSON.parse(localStorage.getItem(CHART_SEL_KEY) || "{}") as Partial<SelState>;
    return {
      api: Array.isArray(x.api) ? x.api.filter((s) => typeof s === "string") : [],
      matcher: Array.isArray(x.matcher) ? x.matcher.filter((s) => typeof s === "string") : [],
      matcherErr: Array.isArray(x.matcherErr) ? x.matcherErr.filter((s) => typeof s === "string") : [],
      durationRecent: Array.isArray(x.durationRecent)
        ? x.durationRecent.filter((s) => typeof s === "string")
        : [],
    };
  } catch {
    return { api: [], matcher: [], matcherErr: [], durationRecent: [] };
  }
}

function saveSel(s: SelState) {
  try {
    localStorage.setItem(CHART_SEL_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const props = defineProps<{
  plugins: PluginRunStatsRow[];
  /** Matcher 曲线用的插件中文名 */
  pluginsMeta?: PluginRow[] | null;
  series: PluginRunSample[];
  busy: boolean;
  apiHistoryByApi?: ApiCallNamedSeries[];
  apiHistoryBucketSec?: number;
  matcherRunsByPlugin?: PluginMatcherNamedSeries[];
  matcherErrorsByPlugin?: PluginMatcherNamedSeries[];
  matcherAvgDurationMsByPlugin?: PluginMatcherNamedSeries[];
  matcherDurationMsByPlugin?: PluginMatcherNamedSeries[];
  matcherDurationLog?: MatcherDurationLogEntry[];
  matcherDurationLogCap?: number;
  matcherDurationLogPerPluginCap?: number;
  matcherHistoryBucketSec?: number;
  /** 今日 Matcher 异常次数 */
  matcherErrorsToday?: number;
  /** 最近 Matcher 异常快照 */
  matcherErrorLog?: MatcherErrorLogEntry[];
  /** GET /console-daily-stats 的 rows（当前选中账号） */
  dailyStatRows?: ConsoleDailyStatRow[] | null;
  /** 图表标题旁小字：API 片段（如「API 22」） */
  toolbarSummaryApi?: string | null;
  /** Matcher 插件显示名片段 */
  toolbarSummaryPlugin?: string | null;
  /** single：单图切换；dashboard：看板多图同屏 */
  layoutMode?: "single" | "dashboard";
  /** dashboard 模式下展示的图表（默认见 DEFAULT_DASHBOARD_PANELS） */
  dashboardPanels?: ChartPanelId[];
}>();

const emit = defineEmits<{
  drawToggle: [expanded: boolean];
  filterToggle: [expanded: boolean];
}>();

const selectedApiKeys = ref<string[]>([]);
const selectedMatcherKeys = ref<string[]>([]);
const selectedMatcherErrKeys = ref<string[]>([]);
const selectedDurationRecentKeys = ref<string[]>([]);
const selHydrated = ref(false);

function localDayStartSec(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function localDayEndSec(): number {
  return localDayStartSec() + 86400;
}

function aggregateLocalToday(points: { at: number; total: number }[]): number[] {
  const bins = Array.from({ length: 24 }, () => 0);
  const t0 = localDayStartSec();
  const t1 = localDayEndSec();
  for (const p of points) {
    const a = Number(p.at);
    if (!Number.isFinite(a) || a < t0 || a >= t1) continue;
    const h = new Date(a * 1000).getHours();
    bins[h] += Number(p.total) || 0;
  }
  return bins;
}

function seriesSum(points: { at: number; total: number }[]): number {
  return points.reduce((s, p) => s + (Number(p.total) || 0), 0);
}

function aggregateLocalTodayAvgDuration(
  durPoints: { at: number; total: number }[],
  runPoints: { at: number; total: number }[],
): number[] {
  const durBins = Array.from({ length: 24 }, () => 0);
  const runBins = Array.from({ length: 24 }, () => 0);
  const t0 = localDayStartSec();
  const t1 = localDayEndSec();
  const bump = (points: { at: number; total: number }[], bins: number[]) => {
    for (const p of points) {
      const a = Number(p.at);
      if (!Number.isFinite(a) || a < t0 || a >= t1) continue;
      const h = new Date(a * 1000).getHours();
      bins[h] += Number(p.total) || 0;
    }
  };
  bump(durPoints, durBins);
  bump(runPoints, runBins);
  return durBins.map((d, h) => (runBins[h]! > 0 ? Math.round(d / runBins[h]!) : 0));
}

function fmtDurationMs(ms: number | null | undefined): string {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "<0.001ms";
  if (n > 0 && n < 0.001) return "<0.001ms";
  if (n < 1) return `${n.toFixed(3)}ms`;
  if (n >= 60_000) return `${(n / 1000).toFixed(1)}s`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  if (n < 10) return `${n.toFixed(1)}ms`;
  return `${Math.round(n)}ms`;
}

/** 单次耗时列表 tooltip：保留原始毫秒精度 */
function fmtDurationMsPrecise(ms: number | null | undefined): string {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 60_000) return `${(n / 1000).toFixed(3)}s（${n.toFixed(3)} ms）`;
  if (n >= 1000) return `${(n / 1000).toFixed(3)}s（${n.toFixed(3)} ms）`;
  if (n < 0.001) return `${n.toFixed(6)} ms`;
  if (n < 1) return `${n.toFixed(4)} ms`;
  if (n < 10) return `${n.toFixed(3)} ms`;
  return `${n.toFixed(2)} ms`;
}

function fmtDurationMsLogList(ms: number | null | undefined, subMsMode: boolean): string {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (subMsMode) {
    if (n === 0) return "<0.001ms";
    if (n < 0.001) return `${n.toFixed(4)}ms`;
    return `${n.toFixed(3)}ms`;
  }
  return fmtDurationMs(ms);
}

const DURATION_HIST_BUCKET_ORDER = ["lt1", "1-10", "10-100", "100-1000", "1s+"] as const;

const DURATION_HIST_BUCKET_LABELS: Record<(typeof DURATION_HIST_BUCKET_ORDER)[number], string> = {
  lt1: "<1ms",
  "1-10": "1–10ms",
  "10-100": "10–100ms",
  "100-1000": "100ms–1s",
  "1s+": ">1s",
};

function durationHistBucketId(ms: number): (typeof DURATION_HIST_BUCKET_ORDER)[number] {
  if (ms < 1) return "lt1";
  if (ms < 10) return "1-10";
  if (ms < 100) return "10-100";
  if (ms < 1000) return "100-1000";
  return "1s+";
}

function durationLogMsValues(rows: MatcherDurationLogEntry[]): number[] {
  return rows
    .map((r) => Number(r.duration_ms))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
}

function percentileSortedMs(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (rank - lo);
}

type DurationHistSegment = { plugin: string; count: number; color: string; y0: number; y1: number };

type DurationHistPack = {
  W: number;
  H: number;
  left: number;
  bottom: number;
  innerW: number;
  innerH: number;
  maxCount: number;
  buckets: {
    id: string;
    label: string;
    x: number;
    w: number;
    total: number;
    segments: DurationHistSegment[];
  }[];
  yTicks: { y: number; t: string }[];
  legend: { plugin: string; label: string; color: string }[];
};

type DurationScatterPoint = {
  cx: number;
  cy: number;
  color: string;
  plugin: string;
  ms: number;
  at: number;
  hadError: boolean;
};

type DurationScatterPack = {
  W: number;
  H: number;
  left: number;
  bottom: number;
  innerW: number;
  innerH: number;
  axisMax: number;
  axisTopPlus: boolean;
  points: DurationScatterPoint[];
  yTicks: { y: number; t: string }[];
  xTicks: { x: number; t: string }[];
  legend: { plugin: string; label: string; color: string }[];
};

function buildDurationHistPack(rows: MatcherDurationLogEntry[]): DurationHistPack | null {
  if (!rows.length) return null;
  const pluginTotals = new Map<string, number>();
  const bucketPluginCounts = new Map<string, Map<string, number>>();
  for (const bid of DURATION_HIST_BUCKET_ORDER) {
    bucketPluginCounts.set(bid, new Map());
  }
  for (const row of rows) {
    const plugin = row.plugin;
    const ms = Number(row.duration_ms) || 0;
    const bid = durationHistBucketId(ms);
    pluginTotals.set(plugin, (pluginTotals.get(plugin) ?? 0) + 1);
    const bp = bucketPluginCounts.get(bid)!;
    bp.set(plugin, (bp.get(plugin) ?? 0) + 1);
  }
  const plugins = [...pluginTotals.keys()].sort(
    (a, b) => (pluginTotals.get(b) ?? 0) - (pluginTotals.get(a) ?? 0) || a.localeCompare(b),
  );
  const W = 440;
  const H = 220;
  const padL = 36;
  const padR = 10;
  const padT = 12;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const bottom = padT + innerH;
  const nB = DURATION_HIST_BUCKET_ORDER.length;
  const slotW = innerW / nB;
  const barW = slotW * 0.72;
  let maxCount = 0;
  const buckets: DurationHistPack["buckets"] = [];
  for (let i = 0; i < nB; i++) {
    const bid = DURATION_HIST_BUCKET_ORDER[i]!;
    const bp = bucketPluginCounts.get(bid)!;
    let total = 0;
    const segments: DurationHistSegment[] = [];
    let stack = 0;
    for (const plugin of plugins) {
      const count = bp.get(plugin) ?? 0;
      if (count <= 0) continue;
      total += count;
      segments.push({
        plugin,
        count,
        color: matcherPluginBarColor(plugin),
        y0: stack,
        y1: stack + count,
      });
      stack += count;
    }
    maxCount = Math.max(maxCount, total);
    const x = left + i * slotW + (slotW - barW) / 2;
    buckets.push({
      id: bid,
      label: DURATION_HIST_BUCKET_LABELS[bid],
      x,
      w: barW,
      total,
      segments,
    });
  }
  if (maxCount <= 0) return null;
  const yTicks = [
    { y: bottom, t: "0次" },
    { y: bottom - innerH * 0.25, t: fmtAxisCountTick(maxCount * 0.25) },
    { y: bottom - innerH / 2, t: fmtAxisCountTick(maxCount / 2) },
    { y: bottom - innerH * 0.75, t: fmtAxisCountTick(maxCount * 0.75) },
    { y: padT, t: fmtAxisCountTick(maxCount) },
  ];
  return {
    W,
    H,
    left,
    bottom,
    innerW,
    innerH,
    maxCount,
    buckets,
    yTicks,
    legend: plugins.map((plugin) => ({
      plugin,
      label: matcherPluginDisplayName(plugin, props.pluginsMeta ?? undefined),
      color: matcherPluginBarColor(plugin),
    })),
  };
}

function buildDurationScatterPack(rows: MatcherDurationLogEntry[]): DurationScatterPack | null {
  if (!rows.length) return null;
  const pluginTotals = new Map<string, number>();
  for (const row of rows) {
    pluginTotals.set(row.plugin, (pluginTotals.get(row.plugin) ?? 0) + 1);
  }
  const plugins = [...pluginTotals.keys()].sort(
    (a, b) => (pluginTotals.get(b) ?? 0) - (pluginTotals.get(a) ?? 0) || a.localeCompare(b),
  );
  const sorted = [...rows].sort((a, b) => (a.at || 0) - (b.at || 0));
  const times = sorted.map((r) => Number(r.at) || 0).filter((t) => t > 0);
  const durs = durationLogMsValues(sorted);
  if (!times.length || !durs.length) return null;
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = Math.max(tMax - tMin, 1);
  const { rawMax, scaleMax } = softBucketAxisMax(durs);
  const axisMax = Math.max(scaleMax, 0.001);
  const axisTopPlus = rawMax > scaleMax;
  const W = 440;
  const H = 220;
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const bottom = padT + innerH;
  const xAt = (t: number) => left + ((t - tMin) / tSpan) * innerW;
  const yAt = (ms: number) => bottom - Math.min(1, ms / axisMax) * innerH;
  const points: DurationScatterPoint[] = sorted.map((row) => {
    const ms = Number(row.duration_ms) || 0;
    const at = Number(row.at) || 0;
    return {
      cx: xAt(at > 0 ? at : tMin),
      cy: yAt(ms),
      color: matcherPluginBarColor(row.plugin),
      plugin: row.plugin,
      ms,
      at,
      hadError: Boolean(row.had_error),
    };
  });
  const tickTimes = pickEvenlySpacedTimes(tMin, tMax, 4);
  const xTicks = cullOverlappingXTicks(
    tickTimes.map((t) => ({ x: xAt(t), t: formatScatterAxisTime(t, tMin, tMax) })),
    64,
  );
  const yTicks = [
    { y: bottom, t: fmtDurationMsAxisTick(0) },
    { y: bottom - innerH * 0.25, t: fmtDurationMsAxisTick(axisMax * 0.25) },
    { y: bottom - innerH / 2, t: fmtDurationMsAxisTick(axisMax / 2) },
    { y: bottom - innerH * 0.75, t: fmtDurationMsAxisTick(axisMax * 0.75) },
    { y: padT, t: axisTopPlus ? `${fmtDurationMsAxisTick(axisMax)}+` : fmtDurationMsAxisTick(axisMax) },
  ];
  return {
    W,
    H,
    left,
    bottom,
    innerW,
    innerH,
    axisMax,
    axisTopPlus,
    points,
    yTicks,
    xTicks,
    legend: plugins.map((plugin) => ({
      plugin,
      label: matcherPluginDisplayName(plugin, props.pluginsMeta ?? undefined),
      color: matcherPluginBarColor(plugin),
    })),
  };
}

function defaultTopKeys(
  keys: string[],
  getPoints: (k: string) => { at: number; total: number }[],
  max: number,
): string[] {
  const scored = keys
    .map((k) => ({ k, sum: seriesSum(getPoints(k)) }))
    .filter((x) => x.sum > 0)
    .sort((a, b) => b.sum - a.sum);
  return scored.slice(0, max).map((x) => x.k);
}

function mergeApiSelection() {
  const rows = props.apiHistoryByApi ?? [];
  const keys = rows.filter((r) => (r.points?.length ?? 0) > 0).map((r) => r.api);
  const cur = selectedApiKeys.value.filter((k) => keys.includes(k));
  if (cur.length) {
    selectedApiKeys.value = cur;
    return;
  }
  const saved = loadSel().api.filter((k) => keys.includes(k));
  if (saved.length) {
    selectedApiKeys.value = saved;
    return;
  }
  selectedApiKeys.value = keys.length
    ? defaultTopKeys(keys, (k) => rows.find((r) => r.api === k)?.points ?? [], 6)
    : [];
}

function mergeMatcherSelection() {
  const rows = props.matcherRunsByPlugin ?? [];
  const durRows = props.matcherAvgDurationMsByPlugin ?? [];
  const keys = [
    ...new Set([
      ...rows.filter((r) => (r.points?.length ?? 0) > 0).map((r) => r.plugin),
      ...durRows.filter((r) => (r.points?.length ?? 0) > 0).map((r) => r.plugin),
    ]),
  ];
  const cur = selectedMatcherKeys.value.filter((k) => keys.includes(k));
  if (cur.length) {
    selectedMatcherKeys.value = cur;
    return;
  }
  const saved = loadSel().matcher.filter((k) => keys.includes(k));
  if (saved.length) {
    selectedMatcherKeys.value = saved;
    return;
  }
  selectedMatcherKeys.value = keys.length
    ? defaultTopKeys(keys, (k) => rows.find((r) => r.plugin === k)?.points ?? [], 6)
    : [];
}

function mergeMatcherErrSelection() {
  const rows = props.matcherErrorsByPlugin ?? [];
  const keys = rows.filter((r) => (r.points?.length ?? 0) > 0).map((r) => r.plugin);
  const cur = selectedMatcherErrKeys.value.filter((k) => keys.includes(k));
  if (cur.length) {
    selectedMatcherErrKeys.value = cur;
    return;
  }
  const saved = loadSel().matcherErr.filter((k) => keys.includes(k));
  if (saved.length) {
    selectedMatcherErrKeys.value = saved;
    return;
  }
  selectedMatcherErrKeys.value = keys.length
    ? defaultTopKeys(keys, (k) => rows.find((r) => r.plugin === k)?.points ?? [], 4)
    : [];
}

function durationRecentPluginKeys(log: MatcherDurationLogEntry[]): string[] {
  const seen = new Set<string>();
  for (const it of log) {
    const p = String(it.plugin ?? "").trim();
    if (p) seen.add(p);
  }
  return [...seen];
}

function durationRecentPluginScore(log: MatcherDurationLogEntry[], plugin: string): number {
  let n = 0;
  for (const it of log) {
    if (it.plugin === plugin) n += 1;
  }
  return n;
}

/** 日志中占比过半的插件（多为复读等高频 Matcher） */
function durationRecentDominantPlugin(
  log: MatcherDurationLogEntry[],
  candidates: { plugin: string; count: number }[],
): { plugin: string; count: number } | null {
  const total = log.length;
  if (total < 8 || !candidates.length) return null;
  const top = candidates[0];
  if (!top || top.count / total < 0.55) return null;
  return top;
}

function defaultDurationRecentKeys(
  log: MatcherDurationLogEntry[],
  keys: string[],
  max = 8,
): string[] {
  if (keys.length <= max) return [...keys];
  const scored = keys
    .map((k) => ({ k, n: durationRecentPluginScore(log, k) }))
    .sort((a, b) => b.n - a.n);
  const total = log.length;
  const top = scored[0];
  const dominated = top && total >= 8 && top.n / total >= 0.55;
  const picked: string[] = [];
  if (dominated) {
    for (const { k } of scored.slice(1)) {
      if (picked.length >= max) break;
      picked.push(k);
    }
  }
  for (const { k } of scored) {
    if (picked.includes(k)) continue;
    if (picked.length >= max) break;
    picked.push(k);
  }
  return picked.length
    ? picked
    : defaultTopKeys(
        keys,
        (k) =>
          Array.from({ length: durationRecentPluginScore(log, k) }, (_, i) => ({
            at: i,
            total: 1,
          })),
        max,
      );
}

/** 列表展示：每插件最多保留若干条（较新优先，log 已为新→旧） */
function capDurationLogPerPlugin(
  rows: MatcherDurationLogEntry[],
  perPlugin: number,
): MatcherDurationLogEntry[] {
  if (perPlugin <= 0 || !rows.length) return rows;
  const counts = new Map<string, number>();
  const out: MatcherDurationLogEntry[] = [];
  for (const it of rows) {
    const p = String(it.plugin ?? "").trim();
    const n = counts.get(p) ?? 0;
    if (n >= perPlugin) continue;
    counts.set(p, n + 1);
    out.push(it);
  }
  return out;
}

function mergeDurationRecentSelection() {
  const log = props.matcherDurationLog ?? [];
  const keys = durationRecentPluginKeys(log);
  const cur = selectedDurationRecentKeys.value.filter((k) => keys.includes(k));
  if (cur.length) {
    selectedDurationRecentKeys.value = cur;
    return;
  }
  const saved = loadSel().durationRecent.filter((k) => keys.includes(k));
  if (saved.length) {
    selectedDurationRecentKeys.value = saved;
    return;
  }
  selectedDurationRecentKeys.value = keys.length ? defaultDurationRecentKeys(log, keys, 8) : [];
}

const chartSeriesSig = computed(() =>
  [
    (props.apiHistoryByApi ?? [])
      .filter((s) => (s.points?.length ?? 0) > 0)
      .map((s) => s.api)
      .sort()
      .join("\0"),
    (props.matcherRunsByPlugin ?? [])
      .filter((s) => (s.points?.length ?? 0) > 0)
      .map((s) => s.plugin)
      .sort()
      .join("\0"),
    (props.matcherErrorsByPlugin ?? [])
      .filter((s) => (s.points?.length ?? 0) > 0)
      .map((s) => s.plugin)
      .sort()
      .join("\0"),
    durationRecentPluginKeys(props.matcherDurationLog ?? []).sort().join("\0"),
  ].join("\x1e"),
);

watch(
  chartSeriesSig,
  () => {
    mergeApiSelection();
    mergeMatcherSelection();
    mergeMatcherErrSelection();
    mergeDurationRecentSelection();
    selHydrated.value = true;
  },
  { immediate: true },
);

watch([selectedApiKeys, selectedMatcherKeys, selectedMatcherErrKeys, selectedDurationRecentKeys], () => {
  if (!selHydrated.value) return;
  saveSel({
    api: [...selectedApiKeys.value],
    matcher: [...selectedMatcherKeys.value],
    matcherErr: [...selectedMatcherErrKeys.value],
    durationRecent: [...selectedDurationRecentKeys.value],
  });
});

/** 排行条宽度：最高项 100%；对 value/max 取 sqrt 再映射到 [MIN, 100)，便于次数等长尾对比 */
const PLUGIN_RANK_BAR_MIN_PCT = 32;

function rankBarWidthPercent(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  const linearRatio = Math.min(1, value / maxValue);
  const curvedRatio = Math.sqrt(linearRatio);
  return Math.round(PLUGIN_RANK_BAR_MIN_PCT + (100 - PLUGIN_RANK_BAR_MIN_PCT) * curvedRatio);
}

/** 耗时条：按 value/max 线性映射至 0–100% */
function linearBarWidthPercent(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.round(Math.min(100, (value / maxValue) * 100));
}

const DURATION_LOG_SUB_MS = 1;
const DURATION_LOG_BAR_MIN_PCT = 10;

/** 单次列表相对条标尺：以 P95 为主，避免极少数极大值压扁常态毫秒级样本 */
function durationLogBarScaleMs(rows: MatcherDurationLogEntry[]): number {
  const vals = durationLogMsValues(rows);
  if (!vals.length) return 0.000_001;
  const max = vals[vals.length - 1]!;
  if (max < DURATION_LOG_SUB_MS) return Math.max(max, 0.000_001);
  const p50 = percentileSortedMs(vals, 50) ?? max;
  const p95 = percentileSortedMs(vals, 95) ?? max;
  const robust = Math.max(p95, p50 * 6, DURATION_LOG_SUB_MS);
  return Math.min(max, robust * 1.2);
}

/** 单次列表相对条：对 value/scale 取 sqrt 映射至 [MIN, 100] */
function durationLogBarWidthPercent(durationMs: number, scaleMs: number, subMsMode: boolean): number {
  const v = Number(durationMs);
  if (!Number.isFinite(v) || v < 0) return 0;
  const scale = Math.max(scaleMs, 0.000_001);
  if (v <= 0) {
    if (subMsMode || scale < DURATION_LOG_SUB_MS) return DURATION_LOG_BAR_MIN_PCT;
    return 0;
  }
  const linearRatio = Math.min(1, v / scale);
  const curvedRatio = Math.sqrt(linearRatio);
  return Math.round(DURATION_LOG_BAR_MIN_PCT + (100 - DURATION_LOG_BAR_MIN_PCT) * curvedRatio);
}

const topPlugins = computed(() =>
  [...props.plugins]
    .filter((p) => p.runs_today > 0)
    .sort((a, b) => b.runs_today - a.runs_today || a.name.localeCompare(b.name)),
);

const maxRunsToday = computed(() => Math.max(1, ...topPlugins.value.map((p) => p.runs_today)));

function pluginRunsBarWidthPercent(p: PluginRunStatsRow): number {
  if (p.runs_today <= 0) return 0;
  return rankBarWidthPercent(p.runs_today, maxRunsToday.value);
}

/** 后端有今日耗时样本即非 null（四舍五入后平均可为 0，与单次列表「<0.01ms」一致） */
function hasDurationSampleToday(p: PluginRunStatsRow): boolean {
  return p.avg_duration_ms_today != null && Number.isFinite(p.avg_duration_ms_today);
}

function pluginTodayDurationBarMs(p: PluginRunStatsRow): number {
  return p.avg_duration_ms_today ?? 0;
}

/** 条长按毫秒缩放；全体低于 1ms 时改用今日次数比例，避免条全空 */
const DURATION_BAR_SUB_MS = 1;

function maxDurationBarMs(list: PluginRunStatsRow[]): number {
  if (!list.length) return 0;
  return Math.max(...list.map(pluginTodayDurationBarMs));
}

const durationBarsSubMsMode = computed(
  () => topPluginsByDuration.value.length > 0 && maxDurationBarMs(topPluginsByDuration.value) < DURATION_BAR_SUB_MS,
);

function maxAvgDurationMsToday(list: PluginRunStatsRow[]): number {
  if (!list.length) return 0;
  return Math.max(...list.map((p) => p.avg_duration_ms_today ?? 0));
}

function pluginDurationBarWidthPercent(p: PluginRunStatsRow): number {
  const list = topPluginsByDuration.value;
  if (!list.length) return 0;
  const maxAvg = maxAvgDurationMsToday(list);
  if (maxAvg >= DURATION_BAR_SUB_MS) {
    return linearBarWidthPercent(p.avg_duration_ms_today ?? 0, maxAvg);
  }
  const maxRun = Math.max(1, ...list.map((x) => x.runs_today));
  return linearBarWidthPercent(p.runs_today, maxRun);
}

function showPeakDurationToday(p: PluginRunStatsRow): boolean {
  const peak = p.max_duration_ms_today;
  if (peak == null || !Number.isFinite(peak)) return false;
  if (durationBarsSubMsMode.value) return peak >= DURATION_BAR_SUB_MS;
  return peak > 0;
}

const topPluginsByDuration = computed(() =>
  [...props.plugins]
    .filter((p) => hasDurationSampleToday(p))
    .sort(
      (a, b) =>
        pluginTodayDurationBarMs(b) - pluginTodayDurationBarMs(a) ||
        b.runs_today - a.runs_today ||
        a.name.localeCompare(b.name),
    ),
);

function fmtBucketSec(sec: number | undefined): string {
  const s = sec ?? 300;
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} 小时`;
  if (s >= 60 && s % 60 === 0) return `${s / 60} 分钟`;
  return `${s} 秒`;
}

function fmtBucketAxisTime(sec: number): string {
  const d = new Date(sec * 1000);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day0 = localDayStartSec();
  if (sec >= day0 && sec < day0 + 86400) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function pickEvenlySpacedTimes(tMin: number, tMax: number, maxTicks: number): number[] {
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return [];
  if (maxTicks <= 1 || tMax <= tMin) return [tMin];
  const out: number[] = [];
  for (let k = 0; k < maxTicks; k++) {
    out.push(Math.round(tMin + (k / (maxTicks - 1)) * (tMax - tMin)));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function formatScatterAxisTime(sec: number, tMin: number, tMax: number): string {
  const span = Math.max(tMax - tMin, 1);
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  if (span < 120) return `${hh}:${mm}:${ss}`;
  return fmtBucketAxisTime(sec);
}

function cullOverlappingXTicks(
  ticks: { x: number; t: string }[],
  minGapPx: number,
): { x: number; t: string }[] {
  if (ticks.length <= 1) return ticks;
  const out: { x: number; t: string }[] = [ticks[0]!];
  for (let i = 1; i < ticks.length; i++) {
    const cur = ticks[i]!;
    if (cur.x - out[out.length - 1]!.x >= minGapPx) out.push(cur);
  }
  const last = ticks[ticks.length - 1]!;
  const tail = out[out.length - 1]!;
  if (tail.x !== last.x && last.x - tail.x >= minGapPx * 0.5) out.push(last);
  return out;
}

/** 压低极少数极高桶对纵轴的拉扯：刻度按 scaleMax，超过部分柱顶截断至顶格（刻度带「+」提示）。 */
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

const BUCKET_CHART_MAX_SLOTS = 56;
const BUCKET_CHART_MAX_SLOTS_NARROW = 40;

/** 时间桶过多时合并相邻桶，避免 slot 过窄导致柱宽为负、SVG 不绘制 */
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

/** 窄视口下略增厚柱宽、收紧桶内边距，避免 SVG 缩放后柱子过细 */
function buildBucketBarPack(
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

  const maxSlots = narrowViewport ? BUCKET_CHART_MAX_SLOTS_NARROW : BUCKET_CHART_MAX_SLOTS;
  const { timesSec: plotTimes, series } = downsampleBucketTimeline(timesSec, seriesRaw, maxSlots);

  const flatVals = series.flatMap((s) => s.vals);
  const { rawMax, scaleMax } = softBucketAxisMax(flatVals);
  const axisMax = scaleMax;
  const axisTopPlus = rawMax > scaleMax;

  const W = 440;
  const H = 212;
  const padL = 42;
  const padR = 10;
  const padT = 10;
  const padB = 34;
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
  const xi = pickTickIndices(nT, 9);
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

function buildHourlyChartPack(
  rows: { label: string; hours: number[] }[],
  fmtTick: (n: number) => string = fmtAxisCountTick,
): HourlyChartPack | null {
  if (!rows.length) return null;
  const formatTick = fmtTick;
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
    poly: row.hours
      .map((v, h) => `${xAt(h).toFixed(2)},${yAt(v).toFixed(2)}`)
      .join(" "),
  }));

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((g) => bottom - g * innerH);
  const yTicks = [
    { y: bottom, t: formatTick(0) },
    { y: bottom - innerH * 0.25, t: formatTick(axisMax * 0.25) },
    { y: bottom - innerH / 2, t: formatTick(axisMax / 2) },
    { y: bottom - innerH * 0.75, t: formatTick(axisMax * 0.75) },
    { y: top, t: axisTopPlus ? `${formatTick(axisMax)}+` : formatTick(axisMax) },
  ];

  return { W, H, left, bottom, innerW, gridYs, yTicks, layers };
}

const apiBucketPack = computed(() => {
  const rows = (props.apiHistoryByApi ?? [])
    .filter((s) => selectedApiKeys.value.includes(s.api) && (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.api, points: s.points }));
  return buildBucketBarPack(rows, bucketViewportNarrow.value);
});

const hourlyApiPack = computed(() => {
  const rows = (props.apiHistoryByApi ?? [])
    .filter((s) => selectedApiKeys.value.includes(s.api) && (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.api, hours: aggregateLocalToday(s.points) }));
  return buildHourlyChartPack(rows);
});

const matcherBucketPack = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherRunsByPlugin ?? [])
    .filter((s) => selectedMatcherKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: matcherPluginDisplayName(s.plugin, meta),
      points: s.points,
    }));
  return buildBucketBarPack(rows, bucketViewportNarrow.value);
});

const hourlyMatcherPack = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherRunsByPlugin ?? [])
    .filter((s) => selectedMatcherKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: matcherPluginDisplayName(s.plugin, meta),
      hours: aggregateLocalToday(s.points),
    }));
  return buildHourlyChartPack(rows);
});

const matcherErrBucketPack = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherErrorsByPlugin ?? [])
    .filter((s) => selectedMatcherErrKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: matcherPluginDisplayName(s.plugin, meta),
      points: s.points,
    }));
  return buildBucketBarPack(rows, bucketViewportNarrow.value);
});

const hourlyMatcherErrPack = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherErrorsByPlugin ?? [])
    .filter((s) => selectedMatcherErrKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: `${matcherPluginDisplayName(s.plugin, meta)} · 异常`,
      hours: aggregateLocalToday(s.points),
    }));
  return buildHourlyChartPack(rows);
});

const matcherDurationBucketPack = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherAvgDurationMsByPlugin ?? [])
    .filter((s) => selectedMatcherKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: `${matcherPluginDisplayName(s.plugin, meta)} · 均耗`,
      points: s.points,
    }));
  return buildBucketBarPack(rows, bucketViewportNarrow.value, fmtDurationMsAxisTick);
});

const hourlyMatcherDurationPack = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherAvgDurationMsByPlugin ?? [])
    .filter((s) => selectedMatcherKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: `${matcherPluginDisplayName(s.plugin, meta)} · 均耗`,
      hours: aggregateLocalTodayAvgDuration(durationMsPoints(s.plugin), durationRunPoints(s.plugin)),
    }))
    .filter((r) => r.hours.some((v) => v > 0));
  return buildHourlyChartPack(rows, fmtDurationMsAxisTick);
});

const sparkPoly = computed((): string | undefined => buildPluginRunSparkPoly(props.series));

function fmtTime(t: number): string {
  return formatPluginRunSampleTime(t);
}

const lastLabel = computed(() => {
  const s = props.series;
  if (!s.length) return "";
  return fmtTime(s[s.length - 1]!.t);
});

const showLocalSpark = computed(
  () => matcherRunCandidates.value.length === 0 && !!sparkPoly.value,
);

const apiCandidates = computed(() =>
  (props.apiHistoryByApi ?? []).filter((s) => (s.points?.length ?? 0) > 0),
);
const matcherRunCandidates = computed(() =>
  (props.matcherRunsByPlugin ?? []).filter((s) => (s.points?.length ?? 0) > 0),
);
const matcherErrCandidates = computed(() =>
  (props.matcherErrorsByPlugin ?? []).filter((s) => (s.points?.length ?? 0) > 0),
);

const matcherDurationCandidates = computed(() =>
  (props.matcherAvgDurationMsByPlugin ?? []).filter((s) => (s.points?.length ?? 0) > 0),
);

const matcherPluginColorMap = computed((): ReadonlyMap<string, string> => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (plugin: string) => {
    const key = String(plugin || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push(key);
  };
  for (const s of matcherDurationCandidates.value) push(s.plugin);
  for (const s of matcherRunCandidates.value) push(s.plugin);
  for (const it of props.matcherDurationLog ?? []) push(it.plugin);
  const map = new Map<string, string>();
  ordered.forEach((plugin, i) => {
    map.set(plugin, chartSeriesColor(i));
  });
  return map;
});

function matcherPluginBarColor(plugin: string): string {
  return matcherPluginColorMap.value.get(plugin) ?? chartSeriesColor(0);
}

function matcherPluginBarFillBackground(color: string): string {
  return `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 80%, transparent))`;
}

function durationRunPoints(plugin: string): { at: number; total: number }[] {
  return props.matcherRunsByPlugin?.find((s) => s.plugin === plugin)?.points ?? [];
}

function durationMsPoints(plugin: string): { at: number; total: number }[] {
  return props.matcherDurationMsByPlugin?.find((s) => s.plugin === plugin)?.points ?? [];
}

function resolveInitialChartPanel(): ChartPanelId {
  const saved = loadChartPanel();
  if (saved) return saved;
  return "matcher_duration_recent";
}

const chartPalette = ref(readChartPalette());

function chartSeriesColor(index: number): string {
  const palette = chartPalette.value;
  return palette[index % palette.length] ?? palette[0] ?? "#38bdf8";
}

const chartPanel = ref<ChartPanelId>(resolveInitialChartPanel());
const panelPickReady = ref(Boolean(loadChartPanel()));
const chartsDrawExpanded = ref(loadChartsDrawExpanded());
const chartsFilterExpanded = ref(loadChartsFilterExpanded());

/** 与首页账户卡断点一致：用于时间桶柱状图加粗柱子 */
const bucketViewportNarrow = ref(false);

function refreshBucketViewportNarrow() {
  if (typeof window === "undefined") return;
  bucketViewportNarrow.value = window.matchMedia("(max-width: 560px)").matches;
}

onMounted(() => {
  refreshBucketViewportNarrow();
  window.addEventListener("resize", refreshBucketViewportNarrow, { passive: true });
  chartPalette.value = readChartPalette();
});

const stopChartThemeWatch = installChartThemeWatcher(() => {
  chartPalette.value = readChartPalette();
});

onUnmounted(() => {
  stopChartThemeWatch();
  if (typeof window === "undefined") return;
  window.removeEventListener("resize", refreshBucketViewportNarrow);
});

/** 图表区底部选项条：图表已展开且用户点「选项」后才显示 */
const chartFilterStripVisible = computed(
  () =>
    !isDashboard.value &&
    chartsDrawExpanded.value &&
    chartsFilterExpanded.value &&
    (chartPanel.value !== "local_spark" || showLocalSpark.value),
);

const chartFilterToggleVisible = computed(
  () =>
    !isDashboard.value &&
    chartsDrawExpanded.value &&
    (chartPanel.value !== "local_spark" || showLocalSpark.value),
);

const toolbarHintText = computed(() => {
  if (!chartsDrawExpanded.value) {
    return "点「展开」后显示图表；需要筛选时再点「选项」。";
  }
  return "";
});

const toolbarHintRowVisible = computed(
  () =>
    Boolean(
      toolbarHintText.value ||
        durationRecentToolbarSummary.value ||
        durationRecentPercentileToolbarText.value,
    ),
);

function toggleChartsDraw() {
  const next = !chartsDrawExpanded.value;
  chartsDrawExpanded.value = next;
  saveChartsDrawExpanded(next);
  if (!next && chartsFilterExpanded.value) {
    chartsFilterExpanded.value = false;
    saveChartsFilterExpanded(false);
    emit("filterToggle", false);
  }
  emit("drawToggle", next);
}

function toggleChartsFilter() {
  const next = !chartsFilterExpanded.value;
  chartsFilterExpanded.value = next;
  saveChartsFilterExpanded(next);
  emit("filterToggle", next);
}

const matcherDurationLogCap = computed(() => {
  const n = Number(props.matcherDurationLogCap);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 150;
});

const matcherDurationLogPerPluginCap = computed(() => {
  const n = Number(props.matcherDurationLogPerPluginCap);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
});

const recentDurationRows = computed(() => props.matcherDurationLog ?? []);

const durationRecentCandidates = computed(() => {
  const log = recentDurationRows.value;
  const keys = durationRecentPluginKeys(log);
  return keys
    .map((plugin) => ({ plugin, count: durationRecentPluginScore(log, plugin) }))
    .sort((a, b) => b.count - a.count || a.plugin.localeCompare(b.plugin));
});

const filteredRecentDurationRowsRaw = computed(() => {
  const rows = recentDurationRows.value;
  const sel = selectedDurationRecentKeys.value;
  if (!rows.length) return [];
  if (!sel.length) return [];
  const allowed = new Set(sel);
  return rows.filter((it) => allowed.has(it.plugin));
});

const filteredRecentDurationRows = computed(() =>
  capDurationLogPerPlugin(filteredRecentDurationRowsRaw.value, matcherDurationLogPerPluginCap.value),
);

type MatcherDurationLogDisplayRow = MatcherDurationLogEntry & {
  barWidthPct: number;
  barColor: string;
};

const durationRecentLogSubMsMode = computed(() => {
  const rows = filteredRecentDurationRows.value;
  if (!rows.length) return false;
  const maxMs = Math.max(...rows.map((r) => Number(r.duration_ms) || 0));
  return maxMs < DURATION_LOG_SUB_MS;
});

const filteredRecentDurationDisplayRows = computed((): MatcherDurationLogDisplayRow[] => {
  const rows = filteredRecentDurationRows.value;
  if (!rows.length) return [];
  const subMs = durationRecentLogSubMsMode.value;
  const scaleMs = durationLogBarScaleMs(rows);
  return rows.map((it) => ({
    ...it,
    barWidthPct: durationLogBarWidthPercent(Number(it.duration_ms) || 0, scaleMs, subMs),
    barColor: matcherPluginBarColor(it.plugin),
  }));
});

const durationRecentToolbarSummary = computed(() => {
  if (chartPanel.value !== "matcher_duration_recent") return "";
  const rows = filteredRecentDurationRows.value;
  if (rows.length < 2) return "";
  const newest = rows[0]!.at;
  const oldest = rows[rows.length - 1]!.at;
  const spanSec = Math.max(0, Math.abs(newest - oldest));
  const spanLabel =
    spanSec >= 3600
      ? `${Math.floor(spanSec / 3600)} 小时 ${Math.floor((spanSec % 3600) / 60)} 分`
      : spanSec >= 60
        ? `${Math.floor(spanSec / 60)} 分 ${spanSec % 60} 秒`
        : `${spanSec} 秒`;
  return `${formatDurationLogAtCompact(newest)} → ${formatDurationLogAtCompact(oldest)} · ${spanLabel} · ${rows.length} 条`;
});

const durationRecentPercentileSummary = computed(() => {
  const vals = durationLogMsValues(filteredRecentDurationRows.value);
  if (!vals.length) return null;
  return {
    n: vals.length,
    p50: percentileSortedMs(vals, 50),
    p95: percentileSortedMs(vals, 95),
    max: vals[vals.length - 1]!,
  };
});

const durationRecentPercentileToolbarText = computed(() => {
  if (
    chartPanel.value !== "matcher_duration_recent" &&
    chartPanel.value !== "matcher_duration_hist" &&
    chartPanel.value !== "matcher_duration_scatter"
  ) {
    return "";
  }
  const s = durationRecentPercentileSummary.value;
  if (!s) return "";
  return `P50 ${fmtDurationMs(s.p50)} · P95 ${fmtDurationMs(s.p95)} · Max ${fmtDurationMs(s.max)} · ${s.n} 条`;
});

const durationHistPack = computed(() => buildDurationHistPack(filteredRecentDurationRows.value));

const durationScatterPack = computed(() => buildDurationScatterPack(filteredRecentDurationRows.value));

const chartUsesDurationLogFilter = computed(
  () =>
    chartPanel.value === "matcher_duration_recent" ||
    chartPanel.value === "matcher_duration_hist" ||
    chartPanel.value === "matcher_duration_scatter",
);

const durationRecentDominant = computed(() =>
  durationRecentDominantPlugin(recentDurationRows.value, durationRecentCandidates.value),
);

function formatDurationLogAt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}

/** 列表内时间列：固定宽度横排，完整时刻放 title */
function formatDurationLogAtCompact(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  try {
    const d = new Date(sec * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return String(sec);
  }
}

const hasMatcherErrSignal = computed(
  () =>
    matcherErrCandidates.value.length > 0 ||
    (props.matcherErrorLog?.length ?? 0) > 0 ||
    (props.matcherErrorsToday ?? 0) > 0,
);

const hasMatcherDurationSignal = computed(
  () =>
    matcherDurationCandidates.value.length > 0 ||
    recentDurationRows.value.length > 0,
);

const panelAvailability = computed(() => ({
  matcher_duration_recent: true,
  matcher_duration_hist: filteredRecentDurationRowsRaw.value.length > 0 || recentDurationRows.value.length > 0,
  matcher_duration_scatter: filteredRecentDurationRowsRaw.value.length > 0 || recentDurationRows.value.length > 0,
  plugins_top: topPlugins.value.length > 0,
  plugins_duration_top: topPluginsByDuration.value.length > 0,
  daily_msg_matcher: (props.dailyStatRows?.length ?? 0) >= 1,
  api_hourly: apiCandidates.value.length > 0,
  api_bucket: apiCandidates.value.length > 0,
  matcher_hourly: matcherRunCandidates.value.length > 0,
  matcher_bucket: matcherRunCandidates.value.length > 0,
  matcher_duration_hourly: hasMatcherDurationSignal.value,
  matcher_duration_bucket: hasMatcherDurationSignal.value,
  matcher_err_hourly: hasMatcherErrSignal.value,
  matcher_err_bucket: hasMatcherErrSignal.value,
  local_spark: showLocalSpark.value,
}));

const isDashboard = computed(() => props.layoutMode === "dashboard");

const effectiveDashboardPanels = computed((): ChartPanelId[] => {
  const custom = props.dashboardPanels;
  if (custom?.length) return custom.filter((id) => isChartPanelId(id));
  return DEFAULT_DASHBOARD_PANELS;
});

function panelVisible(id: ChartPanelId): boolean {
  const avail = panelAvailability.value;
  if (isDashboard.value) {
    return effectiveDashboardPanels.value.includes(id) && avail[id];
  }
  return chartPanel.value === id;
}

function dashboardCellClass(id: ChartPanelId): Record<string, boolean> {
  return {
    "home-plugin-charts-dashboard__cell": isDashboard.value,
    "home-plugin-charts-dashboard__cell--span-2": isDashboard.value && DASHBOARD_PANEL_SPAN2.has(id),
  };
}

const activeChartLoading = computed((): boolean => {
  if (!props.busy) return false;
  switch (chartPanel.value) {
    case "matcher_duration_recent":
      return recentDurationRows.value.length === 0;
    case "matcher_duration_hist":
      return recentDurationRows.value.length === 0 || !durationHistPack.value;
    case "matcher_duration_scatter":
      return recentDurationRows.value.length === 0 || !durationScatterPack.value;
    case "plugins_top":
      return topPlugins.value.length === 0;
    case "plugins_duration_top":
      return topPluginsByDuration.value.length === 0;
    case "daily_msg_matcher":
      return (props.dailyStatRows?.length ?? 0) < 1;
    case "api_hourly":
      return !hourlyApiPack.value;
    case "api_bucket":
      return !apiBucketPack.value;
    case "matcher_hourly":
      return !hourlyMatcherPack.value;
    case "matcher_bucket":
      return !matcherBucketPack.value;
    case "matcher_duration_hourly":
      return !hourlyMatcherDurationPack.value;
    case "matcher_duration_bucket":
      return !matcherDurationBucketPack.value;
    case "matcher_err_hourly":
      return !hourlyMatcherErrPack.value;
    case "matcher_err_bucket":
      return !matcherErrBucketPack.value;
    case "local_spark":
      return false;
    default:
      return true;
  }
});

const chartsDrawVisible = computed(
  () =>
    isDashboard.value ||
    chartsDrawExpanded.value ||
    (props.busy && activeChartLoading.value),
);

const panelOptionGroups = computed(() => {
  const avail = panelAvailability.value;
  return PANEL_GROUPS.map((grp) => ({
    label: grp.label,
    options: grp.panels.map((id) => ({
      id,
      label: PANEL_LABELS[id],
      available: avail[id],
    })),
  }));
});

type ChartExplainItem = { dt: string; dd: string };
type ChartPanelExplain = { lede: string; items: ChartExplainItem[] };

function fmtAxisCount(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (x >= 10_000) return `${(x / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  if (x >= 1000) return `${(x / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function fmtAxisCountTick(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return "0";
  return `${fmtAxisCount(x)}次`;
}

function fmtDurationMsAxisTick(ms: number): string {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return fmtDurationMs(n);
}

const chartPanelExplain = computed((): ChartPanelExplain | null => {
  const cap = matcherDurationLogCap.value;
  const apiBucket = fmtBucketSec(props.apiHistoryBucketSec);
  const matBucket = fmtBucketSec(props.matcherHistoryBucketSec);
  switch (chartPanel.value) {
    case "matcher_duration_recent":
      return {
        lede: "当前账号 · Matcher 墙钟耗时，新→旧。",
        items: [
          { dt: "含义", dd: "单次 matcher 执行耗时，非今日平均。" },
          { dt: "持久化", dd: `本地日志，每账号最多 ${cap} 条。` },
          { dt: "读图", dd: "按插件勾选；P50/P95/Max 基于当前样本。" },
        ],
      };
    case "matcher_duration_hist":
      return {
        lede: "当前账号 · Matcher 耗时分布。",
        items: [
          { dt: "范围", dd: "同「单次耗时」缓冲。" },
          { dt: "读图", dd: "柱高为区间内次数，多插件堆叠。" },
        ],
      };
    case "matcher_duration_scatter":
      return {
        lede: "当前账号 · Matcher 耗时散点，左旧右新。",
        items: [
          { dt: "读图", dd: "纵轴墙钟耗时；悬停看插件与毫秒。" },
        ],
      };
    case "plugins_top":
      return {
        lede: "当前账号 · 插件今日 Matcher 次数。",
        items: [
          { dt: "读图", dd: "条形按次数开方压缩；右侧为次数与平均耗时。" },
        ],
      };
    case "plugins_duration_top":
      return {
        lede: "当前账号 · 插件今日平均 Matcher 耗时。",
        items: [
          { dt: "口径", dd: "preprocessor 至 postprocessor 墙钟耗时。" },
          { dt: "读图", dd: "按平均耗时排序；右侧附今日次数。" },
        ],
      };
    case "daily_msg_matcher":
      return {
        lede: "当前账号 · 按日汇总持久化统计。",
        items: [
          { dt: "读图", dd: "左轴发送/接收消息，右轴 Matcher 与 API；悬停看每日明细。" },
          { dt: "来源", dd: "分片部署时由主节点合并各节点快照。" },
        ],
      };
    case "api_hourly":
      return {
        lede: "当前账号 · 协议 API 今日各小时累计。",
        items: [
          { dt: "读图", dd: "横轴 0–23 本地小时；纵轴累计次数。" },
          { dt: "勾选", dd: "下方勾选要绘制的 OneBot 接口；可切换「按时间桶」对比原始曲线。" },
        ],
      };
    case "api_bucket":
      return {
        lede: `当前账号 · 协议 API 按时间桶（${apiBucket}）。`,
        items: [
          { dt: "读图方式", dd: "纵轴为桶内真实次数；多接口共用同一刻度。" },
          { dt: "勾选", dd: "勾选要对比的接口；横轴为桶起点本地时刻。" },
        ],
      };
    case "matcher_hourly":
      return {
        lede: "当前账号 · 插件 Matcher 今日各小时累计。",
        items: [
          { dt: "读图方式", dd: "横轴 0–23 每小时一刻度；纵轴为该小时执行次数。" },
          { dt: "勾选", dd: "插件名优先展示帮助里的中文名；勾选控制曲线显示。" },
        ],
      };
    case "matcher_bucket":
      return {
        lede: `当前账号 · Matcher 按时间桶（${matBucket}）。`,
        items: [
          { dt: "读图方式", dd: "每柱为插件在该桶内的执行次数；多插件共用纵轴。" },
          { dt: "勾选", dd: "勾选要对比的插件；横轴为桶起点本地时刻。" },
        ],
      };
    case "matcher_duration_hourly":
      return {
        lede: "当前账号 · Matcher 平均耗时（今日各小时）。",
        items: [
          { dt: "读图方式", dd: "纵轴为小时内累计耗时 ÷ 执行次数（毫秒）。" },
          { dt: "勾选", dd: "与 Matcher 次数视图共用插件勾选。" },
        ],
      };
    case "matcher_duration_bucket":
      return {
        lede: `当前账号 · Matcher 平均耗时按桶（${matBucket}）。`,
        items: [
          { dt: "读图方式", dd: "每柱为桶内平均 Matcher 墙钟耗时（毫秒）。" },
          { dt: "勾选", dd: "勾选要对比的插件。" },
        ],
      };
    case "matcher_err_hourly":
      return {
        lede: "当前账号 · Matcher 异常今日各小时。",
        items: [
          { dt: "读图方式", dd: "仅统计 run 结束时带 exception 的次数；与成功执行分开勾选。" },
          { dt: "勾选", dd: "横轴 0–23 每小时一刻度。" },
        ],
      };
    case "matcher_err_bucket":
      return {
        lede: `当前账号 · Matcher 异常按桶（${matBucket}）。`,
        items: [
          { dt: "读图方式", dd: "每柱为桶内异常次数；与成功执行共用桶宽。" },
          { dt: "勾选", dd: "勾选要对比的插件。" },
        ],
      };
    case "local_spark":
      if (!showLocalSpark.value) return null;
      return {
        lede: "本机浏览器快照 · 无服务端时间序列时的累计曲线。",
        items: [
          { dt: "数据来源", dd: "在总览点击「刷新」或切换 Bot 时写入 localStorage。" },
        ],
      };
    default:
      return null;
  }
});

watch(
  [panelAvailability, () => selHydrated.value, () => props.busy],
  () => {
    if (!selHydrated.value) return;
    const a = panelAvailability.value;

    if (!panelPickReady.value) {
      const saved = loadChartPanel();
      if (props.busy) {
        if (saved && chartPanel.value !== saved) {
          chartPanel.value = saved;
        }
        return;
      }
      if (saved && a[saved]) {
        chartPanel.value = saved;
        panelPickReady.value = true;
        return;
      }
      if (saved && !a[saved]) {
        void Promise.resolve().then(() => {
          if (panelPickReady.value) return;
          if (props.busy) return;
          const a2 = panelAvailability.value;
          if (saved && a2[saved]) chartPanel.value = saved;
          else {
            const first = PANEL_ORDER.find((id) => a2[id]);
            if (first) chartPanel.value = first;
          }
          panelPickReady.value = true;
        });
        return;
      }
      const first = PANEL_ORDER.find((id) => a[id]);
      if (first) chartPanel.value = first;
      panelPickReady.value = true;
      return;
    }

    if (!props.busy && !a[chartPanel.value]) {
      const next = PANEL_ORDER.find((id) => a[id]);
      if (next) chartPanel.value = next;
    }
  },
  { immediate: true },
);

watch(chartPanel, (v) => {
  saveChartPanel(v);
});

function toggleAllApis(on: boolean) {
  selectedApiKeys.value = on ? apiCandidates.value.map((s) => s.api) : [];
}

function toggleAllMatchers(on: boolean) {
  selectedMatcherKeys.value = on ? matcherRunCandidates.value.map((s) => s.plugin) : [];
}

function toggleAllMatcherErr(on: boolean) {
  selectedMatcherErrKeys.value = on ? matcherErrCandidates.value.map((s) => s.plugin) : [];
}

function toggleAllDurationRecent(on: boolean) {
  selectedDurationRecentKeys.value = on
    ? durationRecentCandidates.value.map((s) => s.plugin)
    : [];
}

function deselectDominantDurationRecent() {
  const dom = durationRecentDominant.value;
  if (!dom) return;
  selectedDurationRecentKeys.value = selectedDurationRecentKeys.value.filter((k) => k !== dom.plugin);
}

function pluginBarLabel(name: string): string {
  return matcherPluginDisplayName(name, props.pluginsMeta ?? undefined);
}

function pickTickIndices(n: number, maxTicks: number): number[] {
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
</script>

<template>
  <div class="home-plugin-charts-wrap">
  <div
    class="home-plugin-charts"
    :class="{
      'home-plugin-charts--draw-collapsed': !isDashboard && !chartsDrawExpanded,
      'home-plugin-charts--dashboard': isDashboard,
    }"
  >
    <div
      v-if="!isDashboard"
      class="home-plugin-charts__toolbar home-plugin-charts__toolbar--compact"
    >
      <div class="home-plugin-charts__toolbar-line home-plugin-charts__toolbar-line--compact">
        <div class="home-plugin-charts__toolbar-controls">
          <select
            id="home-chart-panel-sel"
            v-model="chartPanel"
            class="sel home-plugin-charts__pick home-plugin-charts__pick--compact"
            aria-label="图表类型"
            title="切换要查看的图表类型（如插件次数/耗时、按日汇总、协议 API 等）"
          >
            <template
              v-for="grp in panelOptionGroups"
              :key="grp.label"
            >
              <optgroup :label="grp.label">
                <option
                  v-for="o in grp.options"
                  :key="o.id"
                  :value="o.id"
                  :disabled="!o.available"
                >
                  {{ o.label }}
                </option>
              </optgroup>
            </template>
          </select>
          <button
            v-if="chartFilterToggleVisible"
            type="button"
            class="home-plugin-charts__draw-toggle home-plugin-charts__draw-toggle--compact home-plugin-charts__filter-toggle"
            :aria-expanded="chartsFilterExpanded"
            :aria-label="chartsFilterExpanded ? '收起绘制选项' : '展开绘制选项'"
            aria-controls="home-account-chart-config-outlet"
            @click="toggleChartsFilter"
          >
            <span
              class="home-plugin-charts__draw-toggle-ico"
              aria-hidden="true"
            >{{ chartsFilterExpanded ? "▼" : "▶" }}</span>
            <span class="home-plugin-charts__draw-toggle-txt">{{ chartsFilterExpanded ? "收起选项" : "选项" }}</span>
          </button>
          <button
            type="button"
            class="home-plugin-charts__draw-toggle home-plugin-charts__draw-toggle--compact"
            :aria-expanded="chartsDrawExpanded"
            :aria-label="chartsDrawExpanded ? '收起图表' : '展开图表'"
            aria-controls="home-plugin-charts-draw"
            @click="toggleChartsDraw"
          >
            <span
              class="home-plugin-charts__draw-toggle-ico"
              aria-hidden="true"
            >{{ chartsDrawExpanded ? "▼" : "▶" }}</span>
            <span class="home-plugin-charts__draw-toggle-txt">{{ chartsDrawExpanded ? "收起" : "展开" }}</span>
          </button>
        </div>
      </div>
    </div>
      <div
        v-if="!isDashboard && toolbarHintRowVisible"
        class="home-plugin-charts__toolbar-hint-row"
      >
        <p
          v-if="toolbarHintText"
          class="home-plugin-charts__toolbar-hint muted"
        >
          {{ toolbarHintText }}
        </p>
        <p
          v-if="durationRecentToolbarSummary"
          class="home-plugin-charts__toolbar-summary muted"
        >
          {{ durationRecentToolbarSummary }}
        </p>
        <p
          v-if="durationRecentPercentileToolbarText"
          class="home-plugin-charts__toolbar-summary home-plugin-charts__toolbar-summary--pct muted"
        >
          {{ durationRecentPercentileToolbarText }}
        </p>
      </div>

    <div
      id="home-plugin-charts-draw"
      v-show="chartsDrawVisible"
      class="home-plugin-charts__draw"
      :class="{
        'home-plugin-charts__draw--loading': busy && activeChartLoading && !isDashboard,
        'home-plugin-charts__draw--dashboard': isDashboard,
      }"
    >
    <HomeChartPanelSkeleton
      v-if="busy && activeChartLoading && !isDashboard"
      tall
      class="home-plugin-charts__draw-skel"
    />
    <template v-else-if="isDashboard || chartsDrawExpanded">
    <div :class="{ 'home-plugin-charts-dashboard': isDashboard }">
    <div
      v-if="panelVisible('matcher_duration_recent')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_duration_recent')"
      data-panel="matcher_duration_recent"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_duration_recent }}
      </h3>
      <div class="home-plugin-charts__flip">
      <HomeChartPanelSkeleton v-if="busy && !recentDurationRows.length" />
      <p
        v-else-if="!recentDurationRows.length"
        class="muted home-plugin-charts__empty"
      >
        暂无单次耗时记录；触发命令后会在此列出最近 {{ matcherDurationLogCap }} 条（重启后仍可从磁盘恢复）。
      </p>
      <p
        v-else-if="!filteredRecentDurationRows.length"
        class="muted home-plugin-charts__empty"
      >
        <template v-if="!selectedDurationRecentKeys.length && durationRecentDominant">
          占记录过半的「{{ pluginBarLabel(durationRecentDominant.plugin) }}」已默认隐藏；点「选项」勾选插件。
        </template>
        <template v-else>
          请至少勾选一个插件（展开「选项」）。
        </template>
      </p>
      <div
        v-else
        class="home-matcher-dur-log home-plugin-charts__viz"
      >
        <div class="home-matcher-dur-log__scroll">
          <div
            class="home-matcher-dur-log__head muted"
            aria-hidden="true"
          >
            <span>耗时</span>
            <span>插件</span>
            <span class="home-matcher-dur-log__head-bar">相对</span>
            <span>时间</span>
            <span />
          </div>
          <ul class="home-matcher-dur-log__list">
            <li
              v-for="(it, idx) in filteredRecentDurationDisplayRows"
              :key="`${it.at}-${idx}-${it.plugin}`"
              class="home-matcher-dur-log__row"
              :class="{ 'home-matcher-dur-log__row--err': it.had_error }"
            >
              <span
                class="home-matcher-dur-log__ms"
                :style="{ color: it.barColor }"
                :title="fmtDurationMsPrecise(it.duration_ms)"
              >{{ fmtDurationMsLogList(it.duration_ms, durationRecentLogSubMsMode) }}</span>
              <span
                class="home-matcher-dur-log__plugin"
                :title="it.plugin"
              >
                <i
                  class="home-matcher-dur-log__plugin-sw"
                  :style="{ background: it.barColor }"
                  aria-hidden="true"
                />
                {{ pluginBarLabel(it.plugin) }}
              </span>
              <div
                class="home-matcher-dur-log__track"
                aria-hidden="true"
              >
                <span
                  class="home-matcher-dur-log__fill"
                  :style="{ width: `${it.barWidthPct}%`, background: matcherPluginBarFillBackground(it.barColor) }"
                />
              </div>
              <span
                class="home-matcher-dur-log__at muted"
                :title="formatDurationLogAt(it.at)"
              >{{ formatDurationLogAtCompact(it.at) }}</span>
              <span
                v-if="it.had_error"
                class="home-matcher-dur-log__badge"
              >异常</span>
            </li>
          </ul>
        </div>
        <div
          v-if="filteredRecentDurationDisplayRows.length >= 2"
          class="home-matcher-dur-log__time-axis home-matcher-dur-log__time-axis--foot muted"
          aria-hidden="true"
        >
          <span class="home-matcher-dur-log__time-axis-label">时间轴</span>
          <span class="home-matcher-dur-log__time-axis-range">
            <span :title="formatDurationLogAt(filteredRecentDurationRows[0]!.at)">{{ formatDurationLogAtCompact(filteredRecentDurationRows[0]!.at) }}</span>
            <span class="home-matcher-dur-log__time-axis-mid">较新 ← → 较旧 · {{ filteredRecentDurationRows.length }} 条</span>
            <span :title="formatDurationLogAt(filteredRecentDurationRows[filteredRecentDurationRows.length - 1]!.at)">{{ formatDurationLogAtCompact(filteredRecentDurationRows[filteredRecentDurationRows.length - 1]!.at) }}</span>
          </span>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_duration_hist')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_duration_hist')"
      data-panel="matcher_duration_hist"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_duration_hist }}
      </h3>
      <div class="home-plugin-charts__flip">
      <HomeChartPanelSkeleton v-if="busy && !recentDurationRows.length" />
      <p v-else-if="!recentDurationRows.length" class="muted home-plugin-charts__empty">暂无单次耗时记录。</p>
      <p v-else-if="!filteredRecentDurationRows.length" class="muted home-plugin-charts__empty">请至少勾选一个插件（展开「选项」）。</p>
      <div v-else-if="durationHistPack" class="home-matcher-dur-analyze home-plugin-charts__viz">
        <svg class="home-matcher-dur-hist__svg" :viewBox="`0 0 ${durationHistPack.W} ${durationHistPack.H}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <line v-for="(gy, gi) in [0, 0.25, 0.5, 0.75, 1]" :key="`dhg-${gi}`" class="home-plugin-bucket__grid" :x1="durationHistPack.left" :y1="durationHistPack.bottom - gy * durationHistPack.innerH" :x2="durationHistPack.left + durationHistPack.innerW" :y2="durationHistPack.bottom - gy * durationHistPack.innerH" />
          <line class="home-plugin-bucket__axis" :x1="durationHistPack.left" :y1="durationHistPack.bottom" :x2="durationHistPack.left + durationHistPack.innerW" :y2="durationHistPack.bottom" />
          <text v-for="(tk, ti) in durationHistPack.yTicks" :key="`dhy-${ti}`" class="home-plugin-bucket__ytick" :x="4" :y="tk.y + 4">{{ tk.t }}</text>
          <template v-for="bucket in durationHistPack.buckets" :key="bucket.id">
            <text class="home-plugin-bucket__xtick" text-anchor="middle" :x="bucket.x + bucket.w / 2" :y="durationHistPack.H - 8">{{ bucket.label }}</text>
            <rect v-for="(seg, si) in bucket.segments" :key="`${bucket.id}-${seg.plugin}-${si}`" class="home-matcher-dur-hist__seg" :x="bucket.x" :y="durationHistPack.bottom - (seg.y1 / durationHistPack.maxCount) * durationHistPack.innerH" :width="bucket.w" :height="Math.max(((seg.y1 - seg.y0) / durationHistPack.maxCount) * durationHistPack.innerH, seg.count > 0 ? 1.2 : 0)" :fill="seg.color" rx="1">
              <title>{{ pluginBarLabel(seg.plugin) }} · {{ bucket.label }} · {{ seg.count }} 次</title>
            </rect>
          </template>
        </svg>
        <div class="home-plugin-legend home-matcher-dur-analyze__legend">
          <span v-for="leg in durationHistPack.legend" :key="`dhl-${leg.plugin}`" class="home-plugin-legend__item">
            <i class="home-plugin-legend__sw" :style="{ background: leg.color }" />
            <span :title="leg.plugin">{{ leg.label }}</span>
          </span>
        </div>
      </div>
      <p v-else class="muted home-plugin-charts__empty">当前样本无法生成分布图。</p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_duration_scatter')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_duration_scatter')"
      data-panel="matcher_duration_scatter"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_duration_scatter }}
      </h3>
      <div class="home-plugin-charts__flip">
      <HomeChartPanelSkeleton v-if="busy && !recentDurationRows.length" />
      <p v-else-if="!recentDurationRows.length" class="muted home-plugin-charts__empty">暂无单次耗时记录。</p>
      <p v-else-if="!filteredRecentDurationRows.length" class="muted home-plugin-charts__empty">请至少勾选一个插件（展开「选项」）。</p>
      <div v-else-if="durationScatterPack" class="home-matcher-dur-analyze home-plugin-charts__viz">
        <svg class="home-matcher-dur-scatter__svg" :viewBox="`0 0 ${durationScatterPack.W} ${durationScatterPack.H}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <line v-for="(gy, gi) in [0, 0.25, 0.5, 0.75, 1]" :key="`dsg-${gi}`" class="home-plugin-bucket__grid" :x1="durationScatterPack.left" :y1="durationScatterPack.bottom - gy * durationScatterPack.innerH" :x2="durationScatterPack.left + durationScatterPack.innerW" :y2="durationScatterPack.bottom - gy * durationScatterPack.innerH" />
          <line class="home-plugin-bucket__axis" :x1="durationScatterPack.left" :y1="durationScatterPack.bottom" :x2="durationScatterPack.left + durationScatterPack.innerW" :y2="durationScatterPack.bottom" />
          <text v-for="(tk, ti) in durationScatterPack.yTicks" :key="`dsy-${ti}`" class="home-plugin-bucket__ytick" :x="4" :y="tk.y + 4">{{ tk.t }}</text>
          <text v-for="(xk, xi) in durationScatterPack.xTicks" :key="`dsx-${xi}`" class="home-plugin-bucket__xtick" text-anchor="middle" :x="xk.x" :y="durationScatterPack.H - 6">{{ xk.t }}</text>
          <circle v-for="(pt, pi) in durationScatterPack.points" :key="`dsp-${pi}-${pt.at}-${pt.plugin}`" class="home-matcher-dur-scatter__dot" :class="{ 'home-matcher-dur-scatter__dot--err': pt.hadError }" :cx="pt.cx" :cy="pt.cy" :r="pt.hadError ? 5.5 : 4" :fill="pt.color">
            <title>{{ pluginBarLabel(pt.plugin) }} · {{ fmtDurationMsPrecise(pt.ms) }} · {{ formatDurationLogAt(pt.at) }}</title>
          </circle>
        </svg>
        <div class="home-plugin-legend home-matcher-dur-analyze__legend">
          <span v-for="leg in durationScatterPack.legend" :key="`dsl-${leg.plugin}`" class="home-plugin-legend__item">
            <i class="home-plugin-legend__sw" :style="{ background: leg.color }" />
            <span :title="leg.plugin">{{ leg.label }}</span>
          </span>
        </div>
      </div>
      <p v-else class="muted home-plugin-charts__empty">当前样本无法生成散点图。</p>
      </div>
    </div>

    <div
      v-if="panelVisible('plugins_top')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('plugins_top')"
      data-panel="plugins_top"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.plugins_top }}
      </h3>
      <div class="home-plugin-charts__flip">
      <HomeChartPanelSkeleton v-if="busy && !topPlugins.length" />
      <p
        v-else-if="!topPlugins.length"
        class="muted home-plugin-charts__empty"
      >
        暂无今日 Matcher 数据。
      </p>
      <div
        v-else
        class="home-plugin-bars home-plugin-bars--fill home-plugin-bars--plugin-rank home-plugin-charts__viz"
      >
        <div
          v-for="p in topPlugins"
          :key="`runs-${p.name}`"
          class="home-plugin-bars__row home-plugin-bars__row--plugin-rank"
        >
          <span
            class="home-plugin-bars__name"
            :title="p.name"
          >{{ pluginBarLabel(p.name) }}</span>
          <div class="home-plugin-bars__track">
            <span
              class="home-plugin-bars__fill home-plugin-bars__fill--runs"
              :style="{ width: `${pluginRunsBarWidthPercent(p)}%` }"
            />
          </div>
          <span class="home-plugin-bars__val home-plugin-bars__val--stack">
            <span class="home-plugin-bars__val-line">今日 {{ p.runs_today }} 次</span>
            <span
              v-if="hasDurationSampleToday(p)"
              class="home-plugin-bars__val-line muted"
            >均 {{ fmtDurationMs(p.avg_duration_ms_today) }}</span>
          </span>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="panelVisible('plugins_duration_top')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('plugins_duration_top')"
      data-panel="plugins_duration_top"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.plugins_duration_top }}
      </h3>
      <div class="home-plugin-charts__flip">
      <HomeChartPanelSkeleton v-if="busy && !topPluginsByDuration.length" />
      <p
        v-else-if="!topPluginsByDuration.length"
        class="muted home-plugin-charts__empty"
      >
        暂无今日 Matcher 耗时样本（需至少执行过一次命令）。
      </p>
      <div
        v-else
        class="home-plugin-duration-rank home-plugin-charts__viz"
      >
        <div class="home-plugin-duration-rank__scroll">
          <div class="home-plugin-bars home-plugin-bars--duration-rank">
            <div
              v-for="p in topPluginsByDuration"
              :key="`dur-${p.name}`"
              class="home-plugin-bars__row home-plugin-bars__row--duration-rank"
            >
              <span
                class="home-plugin-bars__name"
                :title="p.name"
              >{{ pluginBarLabel(p.name) }}</span>
              <div class="home-plugin-bars__track">
                <span
                  class="home-plugin-bars__fill home-plugin-bars__fill--duration"
                  :style="{ width: `${pluginDurationBarWidthPercent(p)}%` }"
                />
              </div>
              <span class="home-plugin-bars__val home-plugin-bars__val--stack">
                <span class="home-plugin-bars__val-line">均 {{ fmtDurationMs(p.avg_duration_ms_today) }}</span>
                <span
                  v-if="showPeakDurationToday(p)"
                  class="home-plugin-bars__val-line muted"
                >峰 {{ fmtDurationMs(p.max_duration_ms_today) }}</span>
                <span
                  v-if="p.runs_today > 0"
                  class="home-plugin-bars__val-line muted"
                >今日 {{ p.runs_today }} 次</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="panelVisible('daily_msg_matcher')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('daily_msg_matcher')"
      data-panel="daily_msg_matcher"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.daily_msg_matcher }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint home-plugin-daily__hint">
          按自然日汇总（磁盘持久化）；左轴为消息收+发合计，右轴为 Matcher 次数。
        </p>
      </template>
      <GsDualAxisTrendChart
        class="home-plugin-charts__viz"
        chart-uid="home-daily-msg"
        :rows="dailyStatRows ?? []"
        :busy="busy"
        empty-text="暂无按日持久化数据。请保持 Bot 运行，跨自然日后会自动写入。"
        :show-summary="false"
      />
      </div>
    </div>

    <div
      v-if="panelVisible('api_hourly')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('api_hourly')"
      data-panel="api_hourly"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.api_hourly }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          横轴 0–23 点为本地自然日，每小时一刻度；将各接口时间桶累计到对应小时。可切换到「按时间桶」视图对比原始桶曲线。
        </p>
        <div
          v-if="apiCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllApis(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllApis(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in apiCandidates"
              :key="s.api"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedApiKeys"
                type="checkbox"
                :value="s.api"
              >
              <span :title="s.api">{{ s.api.length > 26 ? `${s.api.slice(0, 24)}…` : s.api }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="hourlyApiPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeHourlyChartSvg :pack="hourlyApiPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyApiPack.layers"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: ly.color }"
            />
            <span :title="ly.label">{{ ly.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="apiCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一条协议 API 曲线。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无协议 API 时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('api_bucket')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('api_bucket')"
      data-panel="api_bucket"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.api_bucket }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          服务端按固定桶宽累计；柱状图纵轴为<strong>该桶内真实次数</strong>（多曲线共用同一纵轴刻度）。横轴为桶起点时刻（本地显示）。当前桶宽 {{ fmtBucketSec(apiHistoryBucketSec) }}。
        </p>
        <div
          v-if="apiCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllApis(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllApis(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in apiCandidates"
              :key="`bucket-${s.api}`"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedApiKeys"
                type="checkbox"
                :value="s.api"
              >
              <span :title="s.api">{{ s.api.length > 26 ? `${s.api.slice(0, 24)}…` : s.api }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="apiBucketPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeBucketChartSvg :pack="apiBucketPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(s, idx) in apiBucketPack.series"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: s.color }"
            />
            <span :title="s.label">{{ s.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="apiCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一条协议 API 曲线。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无协议 API 时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_hourly')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_hourly')"
      data-panel="matcher_hourly"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_hourly }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          插件名优先展示帮助里的中文名，无则显示内部名。横轴 0–23 每小时一刻度。
        </p>
        <div
          v-if="matcherRunCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in matcherRunCandidates"
              :key="s.plugin"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedMatcherKeys"
                type="checkbox"
                :value="s.plugin"
              >
              <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="hourlyMatcherPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeHourlyChartSvg :pack="hourlyMatcherPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyMatcherPack.layers"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: ly.color }"
            />
            <span :title="ly.label">{{ ly.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="matcherRunCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一个 Matcher 插件。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无 Matcher 时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_bucket')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_bucket')"
      data-panel="matcher_bucket"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_bucket }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          每柱为该插件 Matcher 在对应时间桶内的<strong>执行次数</strong>；多插件共用纵轴。桶宽 {{ fmtBucketSec(matcherHistoryBucketSec) }}；横轴为桶起点（本地显示）。
        </p>
        <div
          v-if="matcherRunCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in matcherRunCandidates"
              :key="`mb-${s.plugin}`"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedMatcherKeys"
                type="checkbox"
                :value="s.plugin"
              >
              <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="matcherBucketPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeBucketChartSvg :pack="matcherBucketPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(s, idx) in matcherBucketPack.series"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: s.color }"
            />
            <span :title="s.label">{{ s.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="matcherRunCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一个 Matcher 插件。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无 Matcher 时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_duration_hourly')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_duration_hourly')"
      data-panel="matcher_duration_hourly"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_duration_hourly }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          纵轴为<strong>该小时桶内累计耗时 ÷ 执行次数</strong>（毫秒）；与 Matcher 次数视图共用插件勾选。横轴 0–23 每小时一刻度。
        </p>
        <div
          v-if="matcherDurationCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in matcherDurationCandidates"
              :key="`mdh-${s.plugin}`"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedMatcherKeys"
                type="checkbox"
                :value="s.plugin"
              >
              <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="hourlyMatcherDurationPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeHourlyChartSvg :pack="hourlyMatcherDurationPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyMatcherDurationPack.layers"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: ly.color }"
            />
            <span :title="ly.label">{{ ly.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="matcherDurationCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一个 Matcher 插件。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无 Matcher 耗时时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_duration_bucket')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_duration_bucket')"
      data-panel="matcher_duration_bucket"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_duration_bucket }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          每柱为该时间桶内<strong>平均 Matcher 墙钟耗时</strong>（毫秒）；桶宽 {{ fmtBucketSec(matcherHistoryBucketSec) }}。
        </p>
        <div
          v-if="matcherDurationCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatchers(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in matcherDurationCandidates"
              :key="`mdb-${s.plugin}`"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedMatcherKeys"
                type="checkbox"
                :value="s.plugin"
              >
              <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="matcherDurationBucketPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeBucketChartSvg :pack="matcherDurationBucketPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(s, idx) in matcherDurationBucketPack.series"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: s.color }"
            />
            <span :title="s.label">{{ s.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="matcherDurationCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一个 Matcher 插件。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无 Matcher 耗时时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_err_hourly')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_err_hourly')"
      data-panel="matcher_err_hourly"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_err_hourly }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          与成功执行分开勾选；仅统计 run 结束时带 exception 的次数。横轴 0–23 每小时一刻度。
        </p>
        <div
          v-if="matcherErrCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatcherErr(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatcherErr(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in matcherErrCandidates"
              :key="`errh-${s.plugin}`"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedMatcherErrKeys"
                type="checkbox"
                :value="s.plugin"
              >
              <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="hourlyMatcherErrPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeHourlyChartSvg :pack="hourlyMatcherErrPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyMatcherErrPack.layers"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: ly.color }"
            />
            <span :title="ly.label">{{ ly.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="matcherErrCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一个插件以查看异常曲线。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无 Matcher 异常时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('matcher_err_bucket')"
      class="home-plugin-charts__block"
      :class="dashboardCellClass('matcher_err_bucket')"
      data-panel="matcher_err_bucket"
    >
      <h3
        v-if="isDashboard"
        class="home-plugin-charts-dashboard__title"
      >
        {{ PANEL_LABELS.matcher_err_bucket }}
      </h3>
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          每柱为该插件在桶内的<strong>异常次数</strong>；与成功执行共用同一桶宽 {{ fmtBucketSec(matcherHistoryBucketSec) }}。横轴为桶起点（本地显示）。
        </p>
        <div
          v-if="matcherErrCandidates.length"
          class="home-plugin-sel"
        >
          <span class="home-plugin-sel__actions">
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatcherErr(true)"
            >
              全选
            </button>
            <button
              type="button"
              class="home-plugin-sel__btn"
              @click="toggleAllMatcherErr(false)"
            >
              全不选
            </button>
          </span>
          <div class="home-plugin-sel__grid">
            <label
              v-for="s in matcherErrCandidates"
              :key="`meb-${s.plugin}`"
              class="home-plugin-sel__item"
            >
              <input
                v-model="selectedMatcherErrKeys"
                type="checkbox"
                :value="s.plugin"
              >
              <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
            </label>
          </div>
        </div>
      </template>
      <div
        v-if="matcherErrBucketPack"
        class="home-plugin-multi home-plugin-charts__viz"
      >
        <HomeBucketChartSvg :pack="matcherErrBucketPack" />
        <div class="home-plugin-legend">
          <span
            v-for="(s, idx) in matcherErrBucketPack.series"
            :key="idx"
            class="home-plugin-legend__item"
          >
            <i
              class="home-plugin-legend__sw"
              :style="{ background: s.color }"
            />
            <span :title="s.label">{{ s.label }}</span>
          </span>
        </div>
      </div>
      <p
        v-else-if="matcherErrCandidates.length"
        class="muted home-plugin-charts__empty"
      >
        请至少勾选一个插件以查看异常曲线。
      </p>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        暂无 Matcher 异常时序数据。
      </p>
      </div>
    </div>

    <div
      v-if="panelVisible('local_spark') && showLocalSpark"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          无服务端时间序列时显示：在总览点击「刷新」或切换 Bot 时写入浏览器本地快照。
        </p>
      </template>
      <div class="home-plugin-spark-wrap home-plugin-charts__viz">
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <polyline
            class="home-plugin-chart-line"
            fill="none"
            :points="sparkPoly"
          />
        </svg>
        <div class="home-plugin-spark-meta muted">
          <span v-if="series.length">末次 {{ lastLabel }}</span>
        </div>
      </div>
      </div>
    </div>
    </div>
    </template>
    </div>

    <div
      id="home-account-chart-config-outlet"
      v-show="chartFilterStripVisible"
      class="home-account-chart-config-outlet"
      :class="{
        'home-account-chart-config-outlet--slot':
          chartsDrawExpanded && chartsFilterExpanded,
      }"
    >
      <div class="home-plugin-charts__filter-external">
        <div
          v-if="chartPanelExplain"
          class="home-panel-explain"
        >
          <p class="home-panel-explain__lede muted">{{ chartPanelExplain.lede }}</p>
          <dl class="home-panel-explain__glossary">
            <div
              v-for="(item, explainIdx) in chartPanelExplain.items"
              :key="`explain-${explainIdx}`"
              class="home-panel-explain__item"
            >
              <dt>{{ item.dt }}</dt>
              <dd>{{ item.dd }}</dd>
            </div>
          </dl>
        </div>
        <div
          v-if="chartPanel === 'api_hourly' && apiCandidates.length"
          class="home-plugin-sel"
        >
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllApis(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllApis(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in apiCandidates" :key="`ext-apih-${s.api}`" class="home-plugin-sel__item">
                <input v-model="selectedApiKeys" type="checkbox" :value="s.api">
                <span :title="s.api">{{ s.api.length > 26 ? `${s.api.slice(0, 24)}…` : s.api }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'api_bucket' && apiCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllApis(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllApis(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in apiCandidates" :key="`ext-apib-${s.api}`" class="home-plugin-sel__item">
                <input v-model="selectedApiKeys" type="checkbox" :value="s.api">
                <span :title="s.api">{{ s.api.length > 26 ? `${s.api.slice(0, 24)}…` : s.api }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'matcher_hourly' && matcherRunCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in matcherRunCandidates" :key="`ext-mh-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedMatcherKeys" type="checkbox" :value="s.plugin">
                <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'matcher_bucket' && matcherRunCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in matcherRunCandidates" :key="`ext-mb-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedMatcherKeys" type="checkbox" :value="s.plugin">
                <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartUsesDurationLogFilter && durationRecentCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllDurationRecent(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllDurationRecent(false)">全不选</button>
              <button
                v-if="durationRecentDominant"
                type="button"
                class="home-plugin-sel__btn"
                @click="deselectDominantDurationRecent"
              >
                取消占多数
              </button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in durationRecentCandidates" :key="`ext-mdr-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedDurationRecentKeys" type="checkbox" :value="s.plugin">
                <span :title="`${s.plugin} · 缓冲 ${s.count} 条`">
                  {{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }} ({{ s.count }})
                </span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'matcher_duration_hourly' && matcherDurationCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in matcherDurationCandidates" :key="`ext-mdh-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedMatcherKeys" type="checkbox" :value="s.plugin">
                <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'matcher_duration_bucket' && matcherDurationCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatchers(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in matcherDurationCandidates" :key="`ext-mdb-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedMatcherKeys" type="checkbox" :value="s.plugin">
                <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'matcher_err_hourly' && matcherErrCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatcherErr(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatcherErr(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in matcherErrCandidates" :key="`ext-meh-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedMatcherErrKeys" type="checkbox" :value="s.plugin">
                <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
              </label>
            </div>
          </div>
        <div v-if="chartPanel === 'matcher_err_bucket' && matcherErrCandidates.length" class="home-plugin-sel">
            <span class="home-plugin-sel__actions">
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatcherErr(true)">全选</button>
              <button type="button" class="home-plugin-sel__btn" @click="toggleAllMatcherErr(false)">全不选</button>
            </span>
            <div class="home-plugin-sel__grid">
              <label v-for="s in matcherErrCandidates" :key="`ext-meb-${s.plugin}`" class="home-plugin-sel__item">
                <input v-model="selectedMatcherErrKeys" type="checkbox" :value="s.plugin">
                <span :title="s.plugin">{{ matcherPluginDisplayName(s.plugin, pluginsMeta ?? undefined) }}</span>
              </label>
            </div>
          </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.home-plugin-charts-wrap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.home-plugin-charts {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.home-plugin-charts__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  padding: 2px 0 4px;
}
.home-plugin-charts__toolbar--compact {
  flex-shrink: 0;
  flex-wrap: nowrap;
  padding: 0 0 2px;
  gap: 6px 8px;
}
.home-plugin-charts__toolbar-line {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
  width: 100%;
}
.home-plugin-charts__toolbar-line--compact {
  flex-direction: row;
  align-items: center;
  gap: 0;
}
.home-plugin-charts__toolbar-controls {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  width: 100%;
}
.home-plugin-charts__toolbar-controls .home-plugin-charts__pick {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(100%, 15rem);
}
.home-plugin-charts__toolbar-controls .home-plugin-charts__draw-toggle {
  flex: 0 0 auto;
}
.home-plugin-charts__toolbar-hint-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px 14px;
  min-width: 0;
  width: 100%;
  padding: 0 0 2px;
}
.home-plugin-charts__toolbar-hint-row .home-plugin-charts__toolbar-hint {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
}
.home-plugin-charts__toolbar-hint-row .home-plugin-charts__toolbar-summary {
  margin: 0;
  flex: 0 0 auto;
  max-width: none;
  text-align: right;
}
.home-plugin-charts__toolbar-summary {
  margin: 0 0 0 6px;
  font-size: 11px;
  line-height: 1.35;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 0 1 auto;
  max-width: min(14rem, 42%);
}
.home-plugin-charts__toolbar-hint {
  margin: 0;
  padding: 0 0 2px;
  font-size: 11px;
  line-height: 1.35;
}
.home-plugin-charts__draw-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: var(--ui-btn-pad-y) var(--ui-btn-pad-x);
  border-radius: var(--radius-control);
  border: 1px solid var(--border);
  background: var(--control-bg);
  color: var(--text-muted);
  font-size: var(--ui-btn-font);
  font-weight: var(--ui-btn-weight);
  cursor: pointer;
  font-family: var(--font-sans);
  transition:
    border-color 0.15s var(--ease),
    color 0.15s var(--ease),
    background 0.15s var(--ease);
}
.home-plugin-charts__draw-toggle--compact {
  padding: 3px 8px;
  font-size: 11px;
  gap: 3px;
  line-height: 1.2;
}
.home-plugin-charts__filter-toggle {
  color: color-mix(in srgb, var(--accent) 72%, var(--text-muted));
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
}
.home-plugin-charts__filter-toggle:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-strong));
}
.home-plugin-charts__draw-toggle-txt {
  font-weight: 600;
}
.home-plugin-charts__draw-toggle:hover {
  border-color: var(--border-strong);
  color: var(--text);
  background: var(--bg-card-hover);
}
.home-plugin-charts__draw-toggle-ico {
  display: inline-block;
  width: 1em;
  text-align: center;
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
}
.home-plugin-charts--draw-collapsed {
  flex: 0 0 auto;
  height: auto;
}

.home-plugin-charts__draw {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.home-plugin-charts__pick {
  min-width: 0;
  max-width: 100%;
  flex: 1 1 auto;
  min-height: var(--ui-sel-min-h);
  padding: var(--ui-ctrl-pad-y) var(--ui-sel-arrow-pad) var(--ui-ctrl-pad-y) var(--ui-ctrl-pad-x);
  font-size: var(--ui-ctrl-font);
}
.home-plugin-charts__pick--compact {
  min-width: 0;
  max-width: 100%;
  min-height: calc(var(--ui-ctrl-height) - 6px);
  font-size: calc(var(--ui-ctrl-font) - 1px);
  padding-top: 5px;
  padding-bottom: 5px;
}
.home-plugin-charts__block {
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.home-plugin-charts__flip {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
.home-plugin-charts__flip > .home-plugin-charts__hint {
  margin: 0;
}
.home-plugin-charts__flip > .home-plugin-sel {
  margin: 0;
}
.home-plugin-charts__viz {
  flex: 1 1 auto;
  min-height: 120px;
  min-width: 0;
}
.home-plugin-charts__viz.home-plugin-multi {
  display: flex;
  flex-direction: column;
}
.home-plugin-charts__viz .home-plugin-spark--hourly,
.home-plugin-charts__viz .home-plugin-hourly-chart__svg {
  height: auto;
  min-height: 120px;
  flex: 1 1 auto;
}
.home-plugin-charts__viz .home-plugin-hourly-chart {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.home-plugin-charts__viz .home-plugin-bucket-chart {
  flex: 1 1 auto;
  min-height: 140px;
  display: flex;
  flex-direction: column;
}
.home-plugin-charts__viz .home-plugin-bucket-chart__svg,
.home-plugin-charts__viz .home-plugin-bucket__svg {
  min-height: 140px;
  max-height: min(360px, 52vh);
  max-width: 100%;
  height: auto;
  aspect-ratio: 440 / 212;
}
.home-plugin-charts__viz .home-plugin-spark:not(.home-plugin-spark--hourly) {
  height: auto;
  min-height: 108px;
  flex: 1 1 auto;
}
.home-plugin-charts__viz .home-plugin-spark:not(.home-plugin-spark--hourly) {
  height: auto;
  min-height: 108px;
  flex: 1 1 auto;
}
.home-plugin-charts__hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
}
.home-plugin-charts__empty {
  margin: 0;
  font-size: 13px;
}
.home-plugin-sel {
  margin-bottom: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-muted);
}
.home-plugin-sel__actions {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 6px;
}
.home-plugin-sel__btn {
  font-size: var(--ui-btn-font);
  font-weight: var(--ui-btn-weight);
  padding: var(--ui-btn-pad-y) var(--ui-btn-pad-x);
  border-radius: var(--radius-control);
  border: 1px solid var(--border);
  background: var(--control-bg);
  color: var(--text-muted);
  cursor: pointer;
}
.home-plugin-sel__btn:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.home-plugin-sel__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
  max-height: 128px;
  overflow-y: auto;
}
.home-plugin-sel__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  line-height: 1.25;
  color: var(--text-muted);
  cursor: pointer;
  max-width: 100%;
}
.home-plugin-sel__item input {
  flex-shrink: 0;
  width: var(--ui-check-size);
  height: var(--ui-check-size);
}
.home-plugin-sel__item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(220px, 46vw);
}
.home-plugin-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 100%;
  box-sizing: border-box;
}
.home-plugin-bars--fill.home-plugin-charts__viz {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  gap: clamp(2px, 0.4vh, 6px);
  overflow-x: hidden;
  overflow-y: auto;
}
.home-plugin-bars--fill.home-plugin-charts__viz > .home-plugin-bars__row {
  flex: 1 1 0;
  min-height: 22px;
}
.home-plugin-bars--plugin-rank.home-plugin-bars--fill.home-plugin-charts__viz > .home-plugin-bars__row {
  min-height: 2rem;
}
.home-plugin-duration-rank.home-plugin-charts__viz {
  --home-plugin-duration-rank-max-h: min(320px, 46vh);
  flex: 0 1 auto;
  align-self: flex-start;
  width: 100%;
  min-height: 0;
  max-height: var(--home-plugin-duration-rank-max-h);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}
.home-plugin-duration-rank__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.home-plugin-bars--duration-rank {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}
.home-plugin-bars--duration-rank > .home-plugin-bars__row {
  flex: none;
  min-height: auto;
}
.home-plugin-bars--plugin-rank .home-plugin-bars__row--plugin-rank {
  grid-template-columns: fit-content(5.75rem) minmax(72px, 1.45fr) minmax(5.25rem, 6rem);
  min-height: 2rem;
  align-items: center;
  gap: 15px;
  padding-left: 8px;
}
.home-plugin-bars--duration-rank .home-plugin-bars__row--duration-rank {
  grid-template-columns: fit-content(5.75rem) minmax(72px, 1.45fr) minmax(5.25rem, 6rem);
  min-height: 2.85rem;
  align-items: center;
  gap: 15px;
  padding-left: 8px;
}
.home-plugin-charts__viz.home-plugin-duration-rank {
  flex: 0 1 auto;
  min-height: 0;
}
.home-plugin-bars__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(80px, 2.2fr) minmax(3.25rem, max-content);
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.home-plugin-bars__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-weight: 600;
}
.home-plugin-bars--plugin-rank .home-plugin-bars__name,
.home-plugin-bars--duration-rank .home-plugin-bars__name {
  min-width: 0;
  max-width: 5.75rem;
}
.home-plugin-bars__track {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  overflow: hidden;
}
.home-plugin-bars__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--chart-bar-mix));
  min-width: 2px;
  transition: width 0.25s var(--ease, ease);
}
.home-plugin-bars__fill--runs {
  background: linear-gradient(90deg, var(--accent), var(--chart-bar-mix));
}
.home-plugin-bars__fill--duration {
  background: linear-gradient(90deg, var(--chart-bar-alt), color-mix(in srgb, var(--chart-bar-alt) 80%, transparent));
}
.home-plugin-bars--plugin-rank .home-plugin-bars__val--stack > .home-plugin-bars__val-line:first-child,
.home-plugin-bars--duration-rank .home-plugin-bars__val--stack > .home-plugin-bars__val-line:first-child {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.home-plugin-bars--plugin-rank .home-plugin-bars__val--stack > .home-plugin-bars__val-line.muted,
.home-plugin-bars--duration-rank .home-plugin-bars__val--stack > .home-plugin-bars__val-line.muted {
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--text-dim);
}
.home-matcher-dur-log {
  --home-matcher-dur-log-ms-col: 5.25rem;
  --home-matcher-dur-log-plugin-col: 5.75rem;
  --home-matcher-dur-log-cols: var(--home-matcher-dur-log-ms-col) var(--home-matcher-dur-log-plugin-col) minmax(36px, 1fr) auto fit-content(2.25rem);
  --home-matcher-dur-log-max-h: min(360px, 48vh);
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-elev);
  padding: 6px 8px;
  max-height: var(--home-matcher-dur-log-max-h);
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.home-matcher-dur-log.home-plugin-charts__viz {
  flex: 0 1 auto;
  align-self: flex-start;
  width: 100%;
}
.home-matcher-dur-log__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  width: 100%;
}
.home-matcher-dur-log__head {
  display: grid;
  grid-template-columns: var(--home-matcher-dur-log-cols);
  gap: 4px 10px;
  padding: 0 6px 4px 2px;
  font-size: 0.72rem;
  width: 100%;
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-elev);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.home-matcher-dur-log__head > span:first-child {
  text-align: left;
}
.home-matcher-dur-log__head-bar {
  font-size: 0.68rem;
  opacity: 0.85;
}
.home-matcher-dur-log__list {
  list-style: none;
  margin: 0;
  padding: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  box-sizing: border-box;
}
.home-matcher-dur-log__row {
  display: grid;
  grid-template-columns: var(--home-matcher-dur-log-cols);
  gap: 4px 10px;
  align-items: center;
  padding: 4px 6px 4px 2px;
  border-radius: 6px;
  background: var(--surface-1);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.home-matcher-dur-log__time-axis {
  display: grid;
  grid-template-columns: var(--home-matcher-dur-log-cols);
  gap: 4px 10px;
  align-items: center;
  margin-top: 6px;
  padding: 6px 6px 2px;
  border-top: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
  font-size: 0.68rem;
  line-height: 1.3;
  width: 100%;
  box-sizing: border-box;
}
.home-matcher-dur-log__time-axis--foot {
  flex: 0 0 auto;
  margin-top: 0;
  grid-template-columns: auto minmax(0, 1fr);
  padding: 6px 8px 4px;
  background: var(--bg-elev);
}
.home-matcher-dur-log__time-axis--foot .home-matcher-dur-log__time-axis-range {
  grid-column: 2 / -1;
}
.home-matcher-dur-log__time-axis-label {
  font-weight: 600;
}
.home-matcher-dur-log__time-axis-range {
  grid-column: 2 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.home-matcher-dur-log__time-axis-range > span:first-child,
.home-matcher-dur-log__time-axis-range > span:last-child {
  flex-shrink: 0;
  white-space: nowrap;
}
.home-matcher-dur-log__time-axis-mid {
  flex: 1 1 auto;
  text-align: center;
  opacity: 0.72;
  white-space: nowrap;
}
.home-matcher-dur-log__row--err {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 20%, transparent);
}
.home-matcher-dur-log__ms {
  font-weight: 700;
  white-space: nowrap;
  text-align: left;
  justify-self: start;
  min-width: 0;
}
.home-matcher-dur-log__plugin {
  min-width: 0;
  max-width: var(--home-matcher-dur-log-plugin-col);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.home-matcher-dur-log__plugin-sw {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  opacity: 0.95;
}
.home-matcher-dur-log__track {
  height: 5px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  overflow: hidden;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}
.home-matcher-dur-log__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  min-width: 2px;
}
.home-matcher-dur-log__at {
  font-size: 0.72rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.home-matcher-dur-log__badge {
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--danger) 20%, transparent);
  color: color-mix(in srgb, var(--danger) 35%, var(--text));
  justify-self: end;
}
.home-plugin-bars__val--stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  line-height: 1.22;
  min-width: 0;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.home-plugin-bars__val--stack > .home-plugin-bars__val-line:first-child {
  font-weight: 700;
  color: var(--text);
}
.home-plugin-bars__val-line {
  display: block;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.home-plugin-bars__val-line.muted {
  font-size: 0.68rem;
}
.home-plugin-bars__subms-hint {
  margin: 0 0 4px;
  font-size: 0.72rem;
  line-height: 1.35;
}
.home-plugin-bars__val {
  text-align: right;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.home-plugin-multi {
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-elev);
  padding: 8px 10px 6px;
  box-sizing: border-box;
  max-width: 100%;
}
.home-plugin-spark {
  width: 100%;
  max-width: 100%;
  height: 72px;
  display: block;
  box-sizing: border-box;
}
.home-plugin-spark--hourly {
  height: 80px;
}
.home-plugin-hour-ticks {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 0 1px;
  font-size: 8px;
  margin: 2px 0 0;
  padding: 0 2px;
  letter-spacing: -0.03em;
  min-width: 0;
}

.home-plugin-hour-ticks span {
  min-width: 0;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}
.home-plugin-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.home-plugin-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
}
.home-plugin-legend__item span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home-plugin-legend__sw {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}
.home-plugin-spark-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-elev);
  padding: 8px 10px 6px;
  box-sizing: border-box;
  max-width: 100%;
}
.home-plugin-spark-meta {
  font-size: 11px;
  margin-top: 4px;
}

.home-plugin-chart-line {
  stroke: var(--chart-palette-1);
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

.home-plugin-bucket__svg {
  width: 100%;
  max-width: 100%;
  height: auto;
  min-height: 140px;
  max-height: min(360px, 52vh);
  aspect-ratio: 440 / 212;
  display: block;
  box-sizing: border-box;
}

.home-plugin-bucket__grid {
  stroke: color-mix(in srgb, var(--border) 88%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.home-plugin-bucket__axis {
  stroke: color-mix(in srgb, var(--border-strong) 92%, var(--border) 8%);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.home-plugin-bucket__ytick {
  font-size: 10px;
  font-weight: 600;
  fill: var(--text-muted);
}

.home-plugin-bucket__xtick {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-muted);
}

.home-plugin-bucket__bar {
  opacity: 0.9;
}

.home-matcher-dur-analyze {
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-elev);
  padding: 8px 10px 8px;
  box-sizing: border-box;
  max-width: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}
.home-matcher-dur-hist__svg,
.home-matcher-dur-scatter__svg {
  width: 100%;
  max-width: 100%;
  min-height: 0;
  height: 100%;
  display: block;
  box-sizing: border-box;
}
.home-plugin-charts__viz .home-matcher-dur-hist__svg,
.home-plugin-charts__viz .home-matcher-dur-scatter__svg {
  min-height: 120px;
  max-height: min(360px, 52vh);
  height: auto;
  aspect-ratio: 440 / 220;
}
.home-plugin-charts__viz .home-matcher-dur-analyze .home-matcher-dur-hist__svg,
.home-plugin-charts__viz .home-matcher-dur-analyze .home-matcher-dur-scatter__svg {
  max-height: none;
  aspect-ratio: auto;
}
.home-matcher-dur-hist__seg {
  opacity: 0.92;
}
.home-matcher-dur-analyze__legend {
  margin-top: 6px;
}
.home-matcher-dur-scatter__dot {
  opacity: 0.85;
}
.home-matcher-dur-scatter__dot--err {
  stroke: color-mix(in srgb, var(--danger) 88%, var(--text));
  stroke-width: 1.5px;
  vector-effect: non-scaling-stroke;
}

/* 按「图表区块实际宽度」断行，避免宽视口 + 窄内容列时仍横向挤压 */
@container (max-width: 640px) {
  .home-plugin-charts__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .home-plugin-charts__toolbar-line--compact {
    flex-direction: column;
    align-items: stretch;
  }

  .home-plugin-charts__toolbar-hint-row {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .home-plugin-charts__toolbar-hint-row .home-plugin-charts__toolbar-hint,
  .home-plugin-charts__toolbar-hint-row .home-plugin-charts__toolbar-summary {
    flex: none;
    width: 100%;
    max-width: none;
    text-align: left;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    word-break: break-word;
  }
}

/* 无容器查询时的回退（整页窄屏） */
@media (max-width: 560px) {
  .home-plugin-charts__toolbar-hint-row {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .home-plugin-charts__toolbar-hint-row .home-plugin-charts__toolbar-hint,
  .home-plugin-charts__toolbar-hint-row .home-plugin-charts__toolbar-summary {
    flex: none;
    width: 100%;
    max-width: none;
    text-align: left;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    word-break: break-word;
  }

  .home-matcher-dur-log {
    --home-matcher-dur-log-cols: minmax(0, 1fr) auto;
  }
  .home-matcher-dur-log__head {
    display: none;
  }
  .home-matcher-dur-log__row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "ms at"
      "plugin plugin"
      "bar bar";
    gap: 2px 8px;
    padding: 8px 8px 8px 10px;
  }
  .home-matcher-dur-log__ms {
    grid-area: ms;
  }
  .home-matcher-dur-log__plugin {
    grid-area: plugin;
    max-width: none;
  }
  .home-matcher-dur-log__track {
    grid-area: bar;
    height: 4px;
  }
  .home-matcher-dur-log__at {
    grid-area: at;
  }
  .home-matcher-dur-log__badge {
    grid-column: 1 / -1;
    justify-self: start;
    margin-top: 2px;
  }
  .home-matcher-dur-log__time-axis--foot {
    grid-template-columns: minmax(0, 1fr);
  }
  .home-matcher-dur-log__time-axis--foot .home-matcher-dur-log__time-axis-range {
    grid-column: 1 / -1;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__row--duration-rank {
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    grid-template-areas:
      "name val"
      "track track";
    gap: 4px 8px;
    min-height: auto;
    padding: 4px 6px;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__name {
    grid-area: name;
    max-width: none;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__track {
    grid-area: track;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__val--stack {
    grid-area: val;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: baseline;
    gap: 2px 6px;
    max-width: min(11rem, 48vw);
  }
}

@container (max-width: 480px) {
  .home-matcher-dur-log {
    --home-matcher-dur-log-cols: minmax(0, 1fr) auto;
  }
  .home-matcher-dur-log__head {
    display: none;
  }
  .home-matcher-dur-log__row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "ms at"
      "plugin plugin"
      "bar bar";
    gap: 2px 8px;
    padding: 8px 8px 8px 10px;
  }
  .home-matcher-dur-log__ms {
    grid-area: ms;
  }
  .home-matcher-dur-log__plugin {
    grid-area: plugin;
    max-width: none;
  }
  .home-matcher-dur-log__track {
    grid-area: bar;
    height: 4px;
  }
  .home-matcher-dur-log__at {
    grid-area: at;
  }
  .home-matcher-dur-log__badge {
    grid-column: 1 / -1;
    justify-self: start;
    margin-top: 2px;
  }
  .home-matcher-dur-log__time-axis--foot {
    grid-template-columns: minmax(0, 1fr);
  }
  .home-matcher-dur-log__time-axis--foot .home-matcher-dur-log__time-axis-range {
    grid-column: 1 / -1;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__row--duration-rank {
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    grid-template-areas:
      "name val"
      "track track";
    gap: 4px 8px;
    min-height: auto;
    padding: 4px 6px;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__name {
    grid-area: name;
    max-width: none;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__track {
    grid-area: track;
  }

  .home-plugin-bars--duration-rank .home-plugin-bars__val--stack {
    grid-area: val;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: baseline;
    gap: 2px 6px;
    max-width: min(11rem, 48vw);
  }
}

@media (max-width: 640px) {
  .home-plugin-charts__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .home-plugin-charts__toolbar-line--compact {
    flex-direction: column;
    align-items: stretch;
  }
}

.home-plugin-daily__hint {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.35;
}

.home-plugin-daily {
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-elev);
  padding: 10px 12px 12px;
  box-sizing: border-box;
  max-width: 100%;
}

.home-plugin-daily__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px 22px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}

.home-plugin-daily__leg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.home-plugin-daily__leg-swatch {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}

.home-plugin-daily__leg-swatch--msg {
  background: linear-gradient(90deg, var(--chart-daily-msg), color-mix(in srgb, var(--chart-daily-msg) 75%, transparent));
}

.home-plugin-daily__leg-swatch--mat {
  background: linear-gradient(90deg, var(--chart-daily-matcher), color-mix(in srgb, var(--chart-daily-matcher) 75%, transparent));
}

.home-plugin-daily__svg-wrap {
  width: 100%;
  max-width: 100%;
  margin: 0;
  box-sizing: border-box;
}

.home-plugin-daily__svg {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  min-height: 200px;
  box-sizing: border-box;
}

.home-plugin-daily__grid {
  stroke: color-mix(in srgb, var(--border) 70%, transparent);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
}

.home-plugin-daily__axis {
  fill: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-sans, system-ui);
}

.home-plugin-daily__axis--left {
  text-anchor: start;
}

.home-plugin-daily__axis--right {
  text-anchor: end;
}

.home-plugin-daily__axis--x {
  text-anchor: middle;
}

.home-plugin-daily__line {
  stroke-width: 2.25px;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.home-plugin-daily__line--msg {
  stroke: var(--chart-daily-msg);
}

.home-plugin-daily__line--mat {
  stroke: var(--chart-daily-matcher);
}

.home-plugin-daily__dot {
  stroke: color-mix(in srgb, var(--panel) 82%, #1f2937 18%);
  stroke-width: 1px;
}

.home-plugin-daily__dot--msg {
  fill: color-mix(in srgb, var(--chart-daily-msg) 14%, var(--bg-card));
}

.home-plugin-daily__dot--mat {
  fill: color-mix(in srgb, var(--chart-daily-matcher) 14%, var(--bg-card));
}

html[data-theme="light"] .home-plugin-daily__line--msg {
  stroke: color-mix(in srgb, var(--chart-daily-msg) 88%, #000 12%);
}

html[data-theme="light"] .home-plugin-daily__line--mat {
  stroke: color-mix(in srgb, var(--chart-daily-matcher) 88%, #000 12%);
}

html[data-theme="light"] .home-plugin-daily__dot--msg {
  fill: color-mix(in srgb, var(--chart-daily-msg) 10%, #fff);
  stroke: color-mix(in srgb, var(--chart-daily-msg) 22%, var(--border));
}

html[data-theme="light"] .home-plugin-daily__dot--mat {
  fill: color-mix(in srgb, var(--chart-daily-matcher) 10%, #fff);
  stroke: color-mix(in srgb, var(--chart-daily-matcher) 22%, var(--border));
}

.home-plugin-daily__bar--msg {
  fill: var(--chart-daily-msg);
}

.home-plugin-daily__bar--mat {
  fill: var(--chart-daily-matcher);
}

.home-plugin-daily__bar-val {
  fill: var(--text);
  font-size: 10px;
  font-weight: 600;
}

.home-plugin-daily__bar-lbl {
  fill: var(--muted);
  font-size: 9px;
}

html[data-theme="light"] .home-plugin-daily__bar--msg {
  fill: color-mix(in srgb, var(--chart-daily-msg) 88%, #000 12%);
}

html[data-theme="light"] .home-plugin-daily__bar--mat {
  fill: color-mix(in srgb, var(--chart-daily-matcher) 88%, #000 12%);
}

.home-plugin-charts__filter-external {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-sizing: border-box;
}
.home-plugin-charts__filter-external .home-panel-explain {
  padding: 8px 10px;
}
.home-plugin-charts__filter-external .home-panel-explain__glossary {
  grid-template-columns: 1fr;
}
.home-plugin-charts__filter-external .home-plugin-sel {
  margin-top: 0;
}

.home-plugin-charts--dashboard {
  gap: 0;
}

.home-plugin-charts__draw--dashboard {
  min-height: 0;
  padding: 0;
}

.home-plugin-charts-dashboard {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.home-plugin-charts-dashboard__cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 14px 12px;
  border-radius: var(--hub-radius, var(--radius-md));
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  box-shadow: var(--hub-shadow, var(--shadow-card));
}

html[data-layout="hub"] .home-plugin-charts-dashboard__cell {
  border-radius: var(--hub-radius);
  background: var(--hub-surface);
}

html[data-layout="hub"][data-surface="glass"] .home-plugin-charts-dashboard__cell {
  backdrop-filter: blur(var(--surface-blur, 12px)) saturate(var(--glass-saturate, 1.12));
  -webkit-backdrop-filter: blur(var(--surface-blur, 12px)) saturate(var(--glass-saturate, 1.12));
  background: color-mix(in srgb, var(--bg-card) calc(var(--card-glass-opacity, 0.25) * 100%), transparent);
  border-color: color-mix(in srgb, var(--border-strong) 40%, transparent);
  box-shadow: var(--glass-elev-shadow), var(--glass-inset-highlight);
}

.home-plugin-charts-dashboard__cell--span-2 {
  grid-column: 1 / -1;
}

.home-plugin-charts-dashboard__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--text);
  line-height: 1.25;
}

.home-plugin-charts--dashboard .home-plugin-charts__block:not(.home-plugin-charts-dashboard__cell) {
  border: none;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.home-plugin-charts--dashboard .home-plugin-charts__viz {
  min-height: 220px;
}

.home-plugin-charts-dashboard__cell--span-2 .home-plugin-charts__viz {
  min-height: 260px;
}

@media (max-width: 900px) {
  .home-plugin-charts-dashboard {
    grid-template-columns: 1fr;
  }

  .home-plugin-charts-dashboard__cell--span-2 {
    grid-column: auto;
  }
}

@media (max-width: 560px) {
  .home-plugin-charts-dashboard {
    gap: 10px;
  }

  .home-plugin-charts-dashboard__cell {
    padding: 12px 10px 10px;
  }

  .home-plugin-charts--dashboard .home-plugin-charts__viz {
    min-height: 200px;
  }
}
</style>
