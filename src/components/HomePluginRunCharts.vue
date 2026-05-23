<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type {
  ApiCallNamedSeries,
  ConsoleDailyStatRow,
  MatcherDurationLogEntry,
  PluginMatcherNamedSeries,
  PluginRunStatsRow,
  PluginRow,
} from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { matcherPluginDisplayName } from "@/utils/pluginDisplayLabel";
import HomeHourlyChartSvg, { type HourlyChartPack } from "@/components/HomeHourlyChartSvg.vue";

const COLORS = ["#ea580c", "#fb923c", "#f97316", "#fdba74", "#c2410c", "#fed7aa", "#fb7185", "#fbbf24"];

/** 今日各小时图横轴刻度 0–23（本地自然日） — 见 HomeHourlyChartSvg */
const CHART_SEL_KEY = "pallas_home_chart_sel_v1";
const CHART_PANEL_KEY = "pallas_home_chart_panel_v1";

type ChartPanelId =
  | "matcher_duration_recent"
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

const PANEL_ORDER: ChartPanelId[] = [
  "matcher_duration_recent",
  "plugins_top",
  "plugins_duration_top",
  "daily_msg_matcher",
  "api_hourly",
  "api_bucket",
  "matcher_hourly",
  "matcher_bucket",
  "matcher_duration_hourly",
  "matcher_duration_bucket",
  "matcher_err_hourly",
  "matcher_err_bucket",
  "local_spark",
];

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

type SelState = { api: string[]; matcher: string[]; matcherErr: string[] };

function loadSel(): SelState {
  try {
    const x = JSON.parse(localStorage.getItem(CHART_SEL_KEY) || "{}") as Partial<SelState>;
    return {
      api: Array.isArray(x.api) ? x.api.filter((s) => typeof s === "string") : [],
      matcher: Array.isArray(x.matcher) ? x.matcher.filter((s) => typeof s === "string") : [],
      matcherErr: Array.isArray(x.matcherErr) ? x.matcherErr.filter((s) => typeof s === "string") : [],
    };
  } catch {
    return { api: [], matcher: [], matcherErr: [] };
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
  /** 与 GET /plugins 一致，用于 Matcher 曲线中文名（metadata.name） */
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
  matcherHistoryBucketSec?: number;
  /** GET /console-daily-stats 的 rows（当前选中账号） */
  dailyStatRows?: ConsoleDailyStatRow[] | null;
  /** 图表标题旁小字：API 片段（如「API 22」） */
  toolbarSummaryApi?: string | null;
  /** 插件 Matcher 片段（如「插件 145」） */
  toolbarSummaryPlugin?: string | null;
  /** Matcher 平均耗时片段（如「均耗 320ms」） */
  toolbarSummaryDuration?: string | null;
}>();

const emit = defineEmits<{
  drawToggle: [expanded: boolean];
  filterToggle: [expanded: boolean];
}>();

const toolbarSummaryText = computed(() => {
  const a = props.toolbarSummaryApi?.trim() ?? "";
  const p = props.toolbarSummaryPlugin?.trim() ?? "";
  const d = props.toolbarSummaryDuration?.trim() ?? "";
  if (!a && !p && !d) return "";
  const parts = [`${a || "API —"}`, `${p || "插件 —"}`];
  if (d) parts.push(d);
  return parts.join(" · ");
});

const selectedApiKeys = ref<string[]>([]);
const selectedMatcherKeys = ref<string[]>([]);
const selectedMatcherErrKeys = ref<string[]>([]);
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
  if (n === 0) return "<0.01ms";
  if (n < 0.01) return "<0.01ms";
  if (n < 1) return `${n.toFixed(2)}ms`;
  if (n >= 60_000) return `${(n / 1000).toFixed(1)}s`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  if (n < 10) return `${n.toFixed(1)}ms`;
  return `${Math.round(n)}ms`;
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
  ].join("\x1e"),
);

watch(
  chartSeriesSig,
  () => {
    mergeApiSelection();
    mergeMatcherSelection();
    mergeMatcherErrSelection();
    selHydrated.value = true;
  },
  { immediate: true },
);

watch([selectedApiKeys, selectedMatcherKeys, selectedMatcherErrKeys], () => {
  if (!selHydrated.value) return;
  saveSel({
    api: [...selectedApiKeys.value],
    matcher: [...selectedMatcherKeys.value],
    matcherErr: [...selectedMatcherErrKeys.value],
  });
});

/** 今日插件横向条：不截断条数，在账户卡右列等高容器内由 flex 铺满（过多时可滚动） */
const topPlugins = computed(() =>
  [...props.plugins]
    .sort((a, b) => b.runs_today - a.runs_today)
    .filter((p) => p.runs_today > 0),
);

const topPluginsByDuration = computed(() =>
  [...props.plugins]
    .filter((p) => (p.avg_duration_ms_today ?? 0) > 0)
    .sort((a, b) => (b.avg_duration_ms_today ?? 0) - (a.avg_duration_ms_today ?? 0)),
);

const maxRuns = computed(() => Math.max(1, ...topPlugins.value.map((p) => p.runs_today)));

const maxDurationToday = computed(() =>
  Math.max(1, ...topPluginsByDuration.value.map((p) => p.avg_duration_ms_today ?? 0)),
);

function fmtBucketSec(sec: number | undefined): string {
  const s = sec ?? 300;
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} 小时`;
  if (s >= 60 && s % 60 === 0) return `${s / 60} 分钟`;
  return `${s} 秒`;
}

type BucketBarSeries = { label: string; color: string; vals: number[] };

type BucketBarPack = {
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

function fmtBucketAxisTime(sec: number): string {
  const d = new Date(sec * 1000);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day0 = localDayStartSec();
  if (sec >= day0 && sec < day0 + 86400) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
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

/** 窄视口下略增厚柱宽、收紧桶内边距，避免 SVG 缩放后柱子过细 */
function buildBucketBarPack(
  rows: { label: string; points: { at: number; total: number }[] }[],
  narrowViewport: boolean,
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

  const series: BucketBarSeries[] = rows.map((row, i) => ({
    label: row.label,
    color: COLORS[i % COLORS.length]!,
    vals: timesSec.map((t) => valAt(row.points, t)),
  }));

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

  const nT = timesSec.length;
  const nS = series.length;
  const slotW = innerW / Math.max(1, nT);
  const bars: { x: number; y: number; w: number; h: number; fill: string }[] = [];

  const marginT = nT <= 3 ? 0.05 : narrowViewport ? 0.055 : 0.08;
  const barFill = narrowViewport ? 0.96 : 0.9;
  const barPad = narrowViewport ? 0.02 : 0.05;
  const minBarW = narrowViewport ? 3.6 : 1.5;

  for (let i = 0; i < nT; i++) {
    const colL = left + i * slotW;
    const groupMargin = slotW * marginT;
    const innerCol = Math.max(0, slotW - 2 * groupMargin);
    const bw = nS > 0 ? innerCol / nS : 0;
    for (let s = 0; s < nS; s++) {
      const v = series[s]!.vals[i] ?? 0;
      const bh = Math.min(1, v / axisMax) * innerH;
      const bx = colL + groupMargin + s * bw + bw * barPad;
      const barW = Math.min(innerCol / Math.max(1, nS) - 0.25, Math.max(minBarW, bw * barFill));
      const by = bottom - bh;
      bars.push({ x: bx, y: by, w: barW, h: bh, fill: series[s]!.color });
    }
  }

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((g) => bottom - g * innerH);
  const fmtTick = (x: number) =>
    Number.isInteger(x) ? String(x) : x >= 10 ? String(Math.round(x)) : x.toFixed(1);
  const yTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH / 2, t: fmtTick(axisMax / 2) },
    { y: top, t: axisTopPlus ? `${fmtTick(axisMax)}+` : fmtTick(axisMax) },
  ];
  const xi = pickTickIndices(nT, 9);
  const xTicks = xi.map((idx) => ({
    x: left + (idx + 0.5) * slotW,
    t: fmtBucketAxisTime(timesSec[idx]!),
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
    timesSec,
    series,
    gridYs,
    yTicks,
    xTicks,
    bars,
  };
}

type HourlyLayerLine = { label: string; color: string; poly: string };

function buildHourlyChartPack(
  rows: { label: string; hours: number[] }[],
  fmtTick?: (n: number) => string,
): HourlyChartPack | null {
  if (!rows.length) return null;
  const formatTick = fmtTick ?? fmtAxisCount;
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

  const layers: HourlyLayerLine[] = rows.map((row, i) => ({
    label: row.label,
    color: COLORS[i % COLORS.length]!,
    poly: row.hours
      .map((v, h) => `${xAt(h).toFixed(2)},${yAt(v).toFixed(2)}`)
      .join(" "),
  }));

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((g) => bottom - g * innerH);
  const yTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH / 2, t: formatTick(axisMax / 2) },
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
  return buildBucketBarPack(rows, bucketViewportNarrow.value);
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
  return buildHourlyChartPack(rows, fmtDurationMs);
});

const sparkPoly = computed((): string | undefined => {
  const s = props.series;
  if (s.length < 2) return undefined;
  const minT = Math.min(...s.map((x) => x.t));
  const maxT = Math.max(...s.map((x) => x.t));
  const totals = s.map((x) => x.total);
  const minV = Math.min(...totals);
  const maxV = Math.max(...totals);
  const dr = maxT - minT || 1;
  const dv = maxV - minV || 1e-6;
  const w = 100;
  const h = 44;
  return s
    .map((pt) => {
      const x = ((pt.t - minT) / dr) * w;
      const y = h - ((pt.total - minV) / dv) * (h - 8) - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
});

function fmtTime(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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

function durationRunPoints(plugin: string): { at: number; total: number }[] {
  return props.matcherRunsByPlugin?.find((s) => s.plugin === plugin)?.points ?? [];
}

function durationMsPoints(plugin: string): { at: number; total: number }[] {
  return props.matcherDurationMsByPlugin?.find((s) => s.plugin === plugin)?.points ?? [];
}

const chartPanel = ref<ChartPanelId>("plugins_top");
const panelPickReady = ref(false);
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
});

onUnmounted(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("resize", refreshBucketViewportNarrow);
});

/** 图表区底部选项条：图表已展开且用户点「选项」后才显示 */
const chartFilterStripVisible = computed(
  () =>
    chartsDrawExpanded.value &&
    chartsFilterExpanded.value &&
    (chartPanel.value !== "local_spark" || showLocalSpark.value),
);

const chartFilterToggleVisible = computed(
  () =>
    chartsDrawExpanded.value &&
    (chartPanel.value !== "local_spark" || showLocalSpark.value),
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
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 80;
});

const recentDurationRows = computed(() => props.matcherDurationLog ?? []);

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

const panelAvailability = computed(() => ({
  matcher_duration_recent: true,
  plugins_top: true,
  plugins_duration_top: topPluginsByDuration.value.length > 0,
  daily_msg_matcher: (props.dailyStatRows?.length ?? 0) >= 1,
  api_hourly: apiCandidates.value.length > 0,
  api_bucket: apiCandidates.value.length > 0,
  matcher_hourly: matcherRunCandidates.value.length > 0,
  matcher_bucket: matcherRunCandidates.value.length > 0,
  matcher_duration_hourly: matcherDurationCandidates.value.length > 0,
  matcher_duration_bucket: matcherDurationCandidates.value.length > 0,
  matcher_err_hourly: matcherErrCandidates.value.length > 0,
  matcher_err_bucket: matcherErrCandidates.value.length > 0,
  local_spark: showLocalSpark.value,
}));

const panelOptions = computed(() => {
  const labels: Record<ChartPanelId, string> = {
    matcher_duration_recent: "Matcher 单次耗时",
    plugins_top: "插件今日次数",
    plugins_duration_top: "插件今日平均耗时",
    daily_msg_matcher: "消息 / Matcher（按日）",
    api_hourly: "协议 API · 今日各小时",
    api_bucket: "协议 API · 按时间桶（柱状）",
    matcher_hourly: "Matcher · 今日各小时",
    matcher_bucket: "Matcher · 按时间桶（柱状）",
    matcher_duration_hourly: "Matcher 耗时 · 今日各小时",
    matcher_duration_bucket: "Matcher 耗时 · 按时间桶",
    matcher_err_hourly: "Matcher 异常 · 今日各小时",
    matcher_err_bucket: "Matcher 异常 · 按时间桶（柱状）",
    local_spark: "Matcher 累计（本机采样）",
  };
  return PANEL_ORDER.map((id) => ({
    id,
    label: labels[id],
    available: panelAvailability.value[id],
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

const chartPanelExplain = computed((): ChartPanelExplain | null => {
  const cap = matcherDurationLogCap.value;
  const apiBucket = fmtBucketSec(props.apiHistoryBucketSec);
  const matBucket = fmtBucketSec(props.matcherHistoryBucketSec);
  switch (chartPanel.value) {
    case "matcher_duration_recent":
      return {
        lede: "当前账号 · 单次 Matcher 墙钟耗时（新→旧）。",
        items: [
          { dt: "数据含义", dd: "每条为一次执行耗时，不是今日平均。" },
          { dt: "持久化", dd: `写入 matcher_durations.jsonl，每账号最多 ${cap} 条。` },
        ],
      };
    case "plugins_top":
      return {
        lede: "当前账号 · 插件今日 Matcher 次数排行。",
        items: [
          { dt: "读图方式", dd: "条形长度为次数；有样本时末尾附带今日平均耗时。" },
          { dt: "相关视图", dd: "单次明细见「Matcher 单次耗时」；耗时排行见「插件今日平均耗时」。" },
        ],
      };
    case "plugins_duration_top":
      return {
        lede: "当前账号 · 按今日平均 Matcher 耗时排序。",
        items: [
          { dt: "统计口径", dd: "preprocessor 至 postprocessor 墙钟耗时；与 plugin-run-stats 一致。" },
          { dt: "读图方式", dd: "条形长度为平均毫秒数；行末「峰」为今日最大单次样本。" },
        ],
      };
    case "daily_msg_matcher":
      return {
        lede: "当前账号 · 按自然日汇总（console_daily_stats.json）。",
        items: [
          { dt: "读图方式", dd: "左轴消息收+发合计，右轴 Matcher 次数；仅 1 天时为柱状图。" },
          { dt: "数据来源", dd: "分片下由 hub 合并 worker 快照与磁盘刷盘；跨自然日写入持久化。" },
        ],
      };
    case "api_hourly":
      return {
        lede: "当前账号 · 协议 API 今日各小时累计。",
        items: [
          { dt: "读图方式", dd: "横轴 0–23 为本地自然日各小时；纵轴为该小时累计调用次数。" },
          { dt: "勾选", dd: "下方勾选要绘制的 OneBot 接口；可切换「按时间桶」对照原始曲线。" },
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
          { dt: "勾选", dd: "插件名优先 metadata.name；勾选控制曲线显示。" },
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
      if (props.busy) return;
      const saved = loadChartPanel();
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

function pluginBarLabel(name: string): string {
  return matcherPluginDisplayName(name, props.pluginsMeta ?? undefined);
}

function catmullStrokePath(pts: { x: number; y: number }[]): string {
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

function linearAreaPath(pts: { x: number; y: number }[], bottomY: number): string {
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

const dailyChartPack = computed(() => {
  const raw = [...(props.dailyStatRows ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (raw.length < 1) return null;
  const W = 400;
  const H = 200;
  const padL = 44;
  const padR = 44;
  const padT = 36;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const top = padT;
  const bottom = padT + innerH;
  const fmtTick = (x: number) => fmtAxisCount(x);
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => bottom - t * innerH);

  if (raw.length === 1) {
    const row = raw[0]!;
    const msgSum = (Number(row.received) || 0) + (Number(row.sent) || 0);
    const mat = Number(row.matcher_runs) || 0;
    const maxM = Math.max(msgSum, 1);
    const maxMat = Math.max(mat, 1);
    const barW = 52;
    const gap = 28;
    const cx = left + innerW / 2;
    const msgX = cx - gap / 2 - barW;
    const matX = cx + gap / 2;
    const msgH = (msgSum / maxM) * innerH;
    const matH = (mat / maxMat) * innerH;
    const dateLabel = row.date.length >= 10 ? row.date.slice(5) : row.date;
    return {
      mode: "bars" as const,
      W,
      H,
      left,
      top,
      bottom,
      innerW,
      innerH,
      gridYs,
      dateLabel,
      singleDay: true,
      leftTicks: [
        { y: bottom, t: "0" },
        { y: bottom - innerH / 2, t: fmtTick(maxM / 2) },
        { y: top, t: fmtTick(maxM) },
      ],
      rightTicks: [
        { y: bottom, t: "0" },
        { y: bottom - innerH / 2, t: fmtTick(maxMat / 2) },
        { y: top, t: fmtTick(maxMat) },
      ],
      bars: [
        {
          x: msgX,
          y: bottom - msgH,
          w: barW,
          h: msgH,
          cls: "msg",
          value: msgSum,
          label: "消息",
        },
        {
          x: matX,
          y: bottom - matH,
          w: barW,
          h: matH,
          cls: "mat",
          value: mat,
          label: "Matcher",
        },
      ],
      xTicks: [{ x: cx, t: dateLabel }],
      msgPathD: "",
      matPathD: "",
      msgAreaD: "",
      matAreaD: "",
      msgDots: [] as { x: number; y: number }[],
      matDots: [] as { x: number; y: number }[],
    };
  }

  const msgSums = raw.map((r) => (Number(r.received) || 0) + (Number(r.sent) || 0));
  const mats = raw.map((r) => Number(r.matcher_runs) || 0);
  const maxM = Math.max(...msgSums, 1);
  const maxMat = Math.max(...mats, 1);
  const n = raw.length;
  const xAt = (i: number) => left + (i / (n - 1)) * innerW;
  const yMsg = (v: number) => bottom - (v / maxM) * innerH;
  const yMat = (v: number) => bottom - (v / maxMat) * innerH;
  const msgPts = msgSums.map((v, i) => ({ x: xAt(i), y: yMsg(v) }));
  const matPts = mats.map((v, i) => ({ x: xAt(i), y: yMat(v) }));
  const msgPathD = catmullStrokePath(msgPts);
  const matPathD = catmullStrokePath(matPts);
  const msgAreaD = linearAreaPath(msgPts, bottom);
  const matAreaD = linearAreaPath(matPts, bottom);
  const leftTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH / 2, t: fmtTick(maxM / 2) },
    { y: top, t: fmtTick(maxM) },
  ];
  const rightTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH / 2, t: fmtTick(maxMat / 2) },
    { y: top, t: fmtTick(maxMat) },
  ];
  const xi = pickTickIndices(n, 10);
  const xTicks = xi.map((i) => ({
    x: xAt(i),
    t: raw[i]!.date.length >= 10 ? raw[i]!.date.slice(5) : raw[i]!.date,
  }));
  return {
    mode: "line" as const,
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
    gridYs,
    msgPathD,
    matPathD,
    msgAreaD,
    matAreaD,
    msgDots: msgPts,
    matDots: matPts,
    leftTicks,
    rightTicks,
    xTicks,
    singleDay: false,
  };
});
</script>

<template>
  <div class="home-plugin-charts-wrap">
  <div
    class="home-plugin-charts"
    :class="{ 'home-plugin-charts--draw-collapsed': !chartsDrawExpanded }"
  >
    <div class="home-plugin-charts__toolbar home-plugin-charts__toolbar--compact">
      <div class="home-plugin-charts__toolbar-line home-plugin-charts__toolbar-line--compact">
        <div class="home-plugin-charts__toolbar-controls">
          <select
            id="home-chart-panel-sel"
            v-model="chartPanel"
            class="sel home-plugin-charts__pick home-plugin-charts__pick--compact"
            aria-label="图表类型"
            title="切换要查看的图表类型（如插件今日次数、按日汇总、协议 API 等）"
          >
            <option
              v-for="o in panelOptions"
              :key="o.id"
              :value="o.id"
              :disabled="!o.available"
            >
              {{ o.label }}
            </option>
          </select>
          <span
            v-if="toolbarSummaryText"
            class="home-plugin-charts__toolbar-summary muted"
          >{{ toolbarSummaryText }}</span>
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
      <p
        v-if="chartFilterToggleVisible && !chartsFilterExpanded"
        class="home-plugin-charts__toolbar-hint muted"
      >
        展开「选项」查看说明与勾选。
      </p>
      <p
        v-else-if="!chartsDrawExpanded"
        class="home-plugin-charts__toolbar-hint muted"
      >
        点「展开」后显示图表；需要筛选时再点「选项」。
      </p>

    <div
      id="home-plugin-charts-draw"
      v-show="chartsDrawExpanded"
      class="home-plugin-charts__draw"
    >
    <div
      v-if="chartPanel === 'matcher_duration_recent'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <p
        v-if="busy && !recentDurationRows.length"
        class="muted home-plugin-charts__empty"
      >
        加载中…
      </p>
      <p
        v-else-if="!recentDurationRows.length"
        class="muted home-plugin-charts__empty"
      >
        暂无单次耗时记录；触发命令后会在此列出最近 {{ matcherDurationLogCap }} 条（重启后仍可从磁盘恢复）。
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
            <span>时间</span>
            <span />
          </div>
          <ul class="home-matcher-dur-log__list">
            <li
              v-for="(it, idx) in recentDurationRows"
              :key="`${it.at}-${idx}-${it.plugin}`"
              class="home-matcher-dur-log__row"
              :class="{ 'home-matcher-dur-log__row--err': it.had_error }"
            >
              <span class="home-matcher-dur-log__ms">{{ fmtDurationMs(it.duration_ms) }}</span>
              <span
                class="home-matcher-dur-log__plugin"
                :title="it.plugin"
              >{{ pluginBarLabel(it.plugin) }}</span>
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
          <div
            v-if="recentDurationRows.length >= 2"
            class="home-matcher-dur-log__time-axis muted"
            aria-hidden="true"
          >
            <span class="home-matcher-dur-log__time-axis-label">时间轴</span>
            <span class="home-matcher-dur-log__time-axis-range">
              <span :title="formatDurationLogAt(recentDurationRows[0]!.at)">{{ formatDurationLogAtCompact(recentDurationRows[0]!.at) }}</span>
              <span class="home-matcher-dur-log__time-axis-mid">较新 ← → 较旧</span>
              <span :title="formatDurationLogAt(recentDurationRows[recentDurationRows.length - 1]!.at)">{{ formatDurationLogAtCompact(recentDurationRows[recentDurationRows.length - 1]!.at) }}</span>
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="chartPanel === 'plugins_top'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <p
        v-if="busy && !topPlugins.length"
        class="muted home-plugin-charts__empty"
      >
        加载中…
      </p>
      <p
        v-else-if="!topPlugins.length"
        class="muted home-plugin-charts__empty"
      >
        暂无今日 Matcher 数据。
      </p>
      <div
        v-else
        class="home-plugin-bars home-plugin-bars--fill home-plugin-charts__viz"
      >
        <div
          v-for="p in topPlugins"
          :key="p.name"
          class="home-plugin-bars__row"
        >
          <span
            class="home-plugin-bars__name"
            :title="p.name"
          >{{ pluginBarLabel(p.name) }}</span>
          <div class="home-plugin-bars__track">
            <span
              class="home-plugin-bars__fill"
              :style="{ width: `${Math.round((p.runs_today / maxRuns) * 100)}%` }"
            />
          </div>
          <span class="home-plugin-bars__val">
            {{ p.runs_today }}<template v-if="p.avg_duration_ms_today"> · {{ fmtDurationMs(p.avg_duration_ms_today) }}</template>
          </span>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="chartPanel === 'plugins_duration_top'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <p
        v-if="busy && !topPluginsByDuration.length"
        class="muted home-plugin-charts__empty"
      >
        加载中…
      </p>
      <p
        v-else-if="!topPluginsByDuration.length"
        class="muted home-plugin-charts__empty"
      >
        暂无今日 Matcher 耗时样本（需至少执行过一次命令）。
      </p>
      <div
        v-else
        class="home-plugin-bars home-plugin-bars--fill home-plugin-charts__viz"
      >
        <div
          v-for="p in topPluginsByDuration"
          :key="`dur-${p.name}`"
          class="home-plugin-bars__row"
        >
          <span
            class="home-plugin-bars__name"
            :title="p.name"
          >{{ pluginBarLabel(p.name) }}</span>
          <div class="home-plugin-bars__track">
            <span
              class="home-plugin-bars__fill home-plugin-bars__fill--duration"
              :style="{ width: `${Math.round(((p.avg_duration_ms_today ?? 0) / maxDurationToday) * 100)}%` }"
            />
          </div>
          <span class="home-plugin-bars__val">
            {{ fmtDurationMs(p.avg_duration_ms_today) }}
            <span
              v-if="p.max_duration_ms_today"
              class="muted"
            > · 峰 {{ fmtDurationMs(p.max_duration_ms_today) }}</span>
          </span>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="chartPanel === 'daily_msg_matcher'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint home-plugin-daily__hint">
          按自然日汇总（磁盘持久化）；左轴为消息收+发合计，右轴为 Matcher 次数。
        </p>
      </template>
      <p
        v-if="busy && !dailyChartPack"
        class="muted home-plugin-charts__empty"
      >
        加载中…
      </p>
      <p
        v-else-if="!dailyChartPack"
        class="muted home-plugin-charts__empty"
      >
        暂无按日持久化数据。请保持 Bot 运行；跨自然日后会写入 <code>console_daily_stats.json</code>。
      </p>
      <template v-else-if="dailyChartPack">
      <p
        v-if="dailyChartPack.singleDay"
        class="muted home-plugin-charts__hint home-plugin-daily__hint"
      >
        当前仅有 1 个自然日记录，以柱状图展示；跨日后将自动切换为折线趋势。
      </p>
      <div class="home-plugin-daily home-plugin-charts__viz">
        <div class="home-plugin-daily__legend muted">
          <span class="home-plugin-daily__leg-item">
            <i
              class="home-plugin-daily__leg-swatch home-plugin-daily__leg-swatch--msg"
              aria-hidden="true"
            />
            消息收+发
          </span>
          <span class="home-plugin-daily__leg-item">
            <i
              class="home-plugin-daily__leg-swatch home-plugin-daily__leg-swatch--mat"
              aria-hidden="true"
            />
            Matcher
          </span>
        </div>
        <div class="home-plugin-daily__svg-wrap">
          <svg
            class="home-plugin-daily__svg"
            :viewBox="`0 0 ${dailyChartPack.W} ${dailyChartPack.H}`"
            preserveAspectRatio="xMidYMid meet"
            overflow="visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="home-daily-msg-area"
                gradientUnits="userSpaceOnUse"
                :x1="dailyChartPack.left"
                :y1="dailyChartPack.bottom"
                :x2="dailyChartPack.left"
                :y2="dailyChartPack.top"
              >
                <stop
                  offset="0%"
                  stop-color="#f472b6"
                  stop-opacity="0"
                />
                <stop
                  offset="100%"
                  stop-color="#f472b6"
                  stop-opacity="0.2"
                />
              </linearGradient>
              <linearGradient
                id="home-daily-mat-area"
                gradientUnits="userSpaceOnUse"
                :x1="dailyChartPack.left"
                :y1="dailyChartPack.bottom"
                :x2="dailyChartPack.left"
                :y2="dailyChartPack.top"
              >
                <stop
                  offset="0%"
                  stop-color="#d946ef"
                  stop-opacity="0"
                />
                <stop
                  offset="100%"
                  stop-color="#d946ef"
                  stop-opacity="0.18"
                />
              </linearGradient>
            </defs>
            <line
              v-for="(gy, gi) in dailyChartPack.gridYs"
              :key="`g-${gi}`"
              class="home-plugin-daily__grid"
              :x1="dailyChartPack.left"
              :y1="gy"
              :x2="dailyChartPack.left + dailyChartPack.innerW"
              :y2="gy"
            />
            <text
              v-for="(tk, ti) in dailyChartPack.leftTicks"
              :key="`lt-${ti}`"
              class="home-plugin-daily__axis home-plugin-daily__axis--left"
              :x="6"
              :y="tk.y + 4"
            >{{ tk.t }}</text>
            <text
              v-for="(tk, ti) in dailyChartPack.rightTicks"
              :key="`rt-${ti}`"
              class="home-plugin-daily__axis home-plugin-daily__axis--right"
              :x="dailyChartPack.W - 6"
              :y="tk.y + 4"
            >{{ tk.t }}</text>
            <text
              v-for="(xt, xi) in dailyChartPack.xTicks"
              :key="`xt-${xi}`"
              class="home-plugin-daily__axis home-plugin-daily__axis--x"
              :x="xt.x"
              :y="dailyChartPack.H - 8"
            >{{ xt.t }}</text>
            <template v-if="dailyChartPack.mode === 'bars'">
              <rect
                v-for="(bar, bi) in dailyChartPack.bars"
                :key="`db-${bi}`"
                class="home-plugin-daily__bar"
                :class="bar.cls === 'msg' ? 'home-plugin-daily__bar--msg' : 'home-plugin-daily__bar--mat'"
                :x="bar.x"
                :y="bar.y"
                :width="bar.w"
                :height="Math.max(bar.h, 0)"
                rx="3"
              />
              <text
                v-for="(bar, bi) in dailyChartPack.bars"
                :key="`dbv-${bi}`"
                class="home-plugin-daily__bar-val"
                :x="bar.x + bar.w / 2"
                :y="bar.y - 6"
                text-anchor="middle"
              >{{ fmtAxisCount(bar.value) }}</text>
              <text
                v-for="(bar, bi) in dailyChartPack.bars"
                :key="`dbl-${bi}`"
                class="home-plugin-daily__bar-lbl muted"
                :x="bar.x + bar.w / 2"
                :y="dailyChartPack.bottom + 18"
                text-anchor="middle"
              >{{ bar.label }}</text>
            </template>
            <template v-else>
              <path
                class="home-plugin-daily__area home-plugin-daily__area--mat"
                :d="dailyChartPack.matAreaD"
                fill="url(#home-daily-mat-area)"
              />
              <path
                class="home-plugin-daily__area home-plugin-daily__area--msg"
                :d="dailyChartPack.msgAreaD"
                fill="url(#home-daily-msg-area)"
              />
              <path
                class="home-plugin-daily__line home-plugin-daily__line--mat"
                :d="dailyChartPack.matPathD"
                fill="none"
              />
              <path
                class="home-plugin-daily__line home-plugin-daily__line--msg"
                :d="dailyChartPack.msgPathD"
                fill="none"
              />
              <circle
                v-for="(p, di) in dailyChartPack.matDots"
                :key="`md-${di}`"
                class="home-plugin-daily__dot home-plugin-daily__dot--mat"
                :cx="p.x"
                :cy="p.y"
                r="3.2"
              />
              <circle
                v-for="(p, di) in dailyChartPack.msgDots"
                :key="`mg-${di}`"
                class="home-plugin-daily__dot home-plugin-daily__dot--msg"
                :cx="p.x"
                :cy="p.y"
                r="3.2"
              />
            </template>
          </svg>
        </div>
      </div>
      </template>
      </div>
    </div>

    <div
      v-if="chartPanel === 'api_hourly'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          横轴 0–23 点为本地自然日，每小时一刻度；将各接口时间桶累计到对应小时。可切换到「按时间桶」视图对照原始桶曲线。
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
      v-if="chartPanel === 'api_bucket'"
      class="home-plugin-charts__block"
    >
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
        <svg
          class="home-plugin-bucket__svg"
          :viewBox="`0 0 ${apiBucketPack.W} ${apiBucketPack.H}`"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          aria-hidden="true"
        >
          <line
            v-for="(gy, gi) in apiBucketPack.gridYs"
            :key="`ag-${gi}`"
            class="home-plugin-bucket__grid"
            :x1="apiBucketPack.left"
            :y1="gy"
            :x2="apiBucketPack.left + apiBucketPack.innerW"
            :y2="gy"
          />
          <line
            class="home-plugin-bucket__axis"
            :x1="apiBucketPack.left"
            :y1="apiBucketPack.bottom"
            :x2="apiBucketPack.left + apiBucketPack.innerW"
            :y2="apiBucketPack.bottom"
          />
          <text
            v-for="(tk, ti) in apiBucketPack.yTicks"
            :key="`ayt-${ti}`"
            class="home-plugin-bucket__ytick"
            :x="4"
            :y="tk.y + 4"
          >{{ tk.t }}</text>
          <text
            v-for="(xk, xi) in apiBucketPack.xTicks"
            :key="`axt-${xi}`"
            class="home-plugin-bucket__xtick"
            text-anchor="middle"
            :x="xk.x"
            :y="apiBucketPack.H - 6"
          >{{ xk.t }}</text>
          <rect
            v-for="(b, bi) in apiBucketPack.bars"
            :key="`ab-${bi}`"
            class="home-plugin-bucket__bar"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            :fill="b.fill"
            rx="1.5"
          />
        </svg>
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
      v-if="chartPanel === 'matcher_hourly'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__flip">
      <template v-if="false">
        <p class="muted home-plugin-charts__hint">
          插件名优先展示 <code>metadata.name</code>（与帮助系统一致），无则显示内部名。横轴 0–23 每小时一刻度。
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
      v-if="chartPanel === 'matcher_bucket'"
      class="home-plugin-charts__block"
    >
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
        <svg
          class="home-plugin-bucket__svg"
          :viewBox="`0 0 ${matcherBucketPack.W} ${matcherBucketPack.H}`"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          aria-hidden="true"
        >
          <line
            v-for="(gy, gi) in matcherBucketPack.gridYs"
            :key="`mg-${gi}`"
            class="home-plugin-bucket__grid"
            :x1="matcherBucketPack.left"
            :y1="gy"
            :x2="matcherBucketPack.left + matcherBucketPack.innerW"
            :y2="gy"
          />
          <line
            class="home-plugin-bucket__axis"
            :x1="matcherBucketPack.left"
            :y1="matcherBucketPack.bottom"
            :x2="matcherBucketPack.left + matcherBucketPack.innerW"
            :y2="matcherBucketPack.bottom"
          />
          <text
            v-for="(tk, ti) in matcherBucketPack.yTicks"
            :key="`myt-${ti}`"
            class="home-plugin-bucket__ytick"
            :x="4"
            :y="tk.y + 4"
          >{{ tk.t }}</text>
          <text
            v-for="(xk, xi) in matcherBucketPack.xTicks"
            :key="`mxt-${xi}`"
            class="home-plugin-bucket__xtick"
            text-anchor="middle"
            :x="xk.x"
            :y="matcherBucketPack.H - 6"
          >{{ xk.t }}</text>
          <rect
            v-for="(b, bi) in matcherBucketPack.bars"
            :key="`mb-${bi}`"
            class="home-plugin-bucket__bar"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            :fill="b.fill"
            rx="1.5"
          />
        </svg>
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
      v-if="chartPanel === 'matcher_duration_hourly'"
      class="home-plugin-charts__block"
    >
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
      v-if="chartPanel === 'matcher_duration_bucket'"
      class="home-plugin-charts__block"
    >
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
        <svg
          class="home-plugin-bucket__svg"
          :viewBox="`0 0 ${matcherDurationBucketPack.W} ${matcherDurationBucketPack.H}`"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          aria-hidden="true"
        >
          <line
            v-for="(gy, gi) in matcherDurationBucketPack.gridYs"
            :key="`mdg-${gi}`"
            class="home-plugin-bucket__grid"
            :x1="matcherDurationBucketPack.left"
            :y1="gy"
            :x2="matcherDurationBucketPack.left + matcherDurationBucketPack.innerW"
            :y2="gy"
          />
          <line
            class="home-plugin-bucket__axis"
            :x1="matcherDurationBucketPack.left"
            :y1="matcherDurationBucketPack.bottom"
            :x2="matcherDurationBucketPack.left + matcherDurationBucketPack.innerW"
            :y2="matcherDurationBucketPack.bottom"
          />
          <text
            v-for="(tk, ti) in matcherDurationBucketPack.yTicks"
            :key="`mdyt-${ti}`"
            class="home-plugin-bucket__ylabel"
            :x="matcherDurationBucketPack.padL - 4"
            :y="tk.y + 4"
            text-anchor="end"
          >{{ tk.t }}</text>
          <text
            v-for="(xk, xi) in matcherDurationBucketPack.xTicks"
            :key="`mdxt-${xi}`"
            class="home-plugin-bucket__xlabel"
            :x="xk.x"
            :y="matcherDurationBucketPack.H - 6"
            text-anchor="middle"
          >{{ xk.t }}</text>
          <rect
            v-for="(b, bi) in matcherDurationBucketPack.bars"
            :key="`mdb-${bi}`"
            class="home-plugin-bucket__bar"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            :fill="b.fill"
            rx="1.5"
          />
        </svg>
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
      v-if="chartPanel === 'matcher_err_hourly'"
      class="home-plugin-charts__block"
    >
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
      v-if="chartPanel === 'matcher_err_bucket'"
      class="home-plugin-charts__block"
    >
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
        <svg
          class="home-plugin-bucket__svg"
          :viewBox="`0 0 ${matcherErrBucketPack.W} ${matcherErrBucketPack.H}`"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          aria-hidden="true"
        >
          <line
            v-for="(gy, gi) in matcherErrBucketPack.gridYs"
            :key="`eg-${gi}`"
            class="home-plugin-bucket__grid"
            :x1="matcherErrBucketPack.left"
            :y1="gy"
            :x2="matcherErrBucketPack.left + matcherErrBucketPack.innerW"
            :y2="gy"
          />
          <line
            class="home-plugin-bucket__axis"
            :x1="matcherErrBucketPack.left"
            :y1="matcherErrBucketPack.bottom"
            :x2="matcherErrBucketPack.left + matcherErrBucketPack.innerW"
            :y2="matcherErrBucketPack.bottom"
          />
          <text
            v-for="(tk, ti) in matcherErrBucketPack.yTicks"
            :key="`eyt-${ti}`"
            class="home-plugin-bucket__ytick"
            :x="4"
            :y="tk.y + 4"
          >{{ tk.t }}</text>
          <text
            v-for="(xk, xi) in matcherErrBucketPack.xTicks"
            :key="`ext-${xi}`"
            class="home-plugin-bucket__xtick"
            text-anchor="middle"
            :x="xk.x"
            :y="matcherErrBucketPack.H - 6"
          >{{ xk.t }}</text>
          <rect
            v-for="(b, bi) in matcherErrBucketPack.bars"
            :key="`eb-${bi}`"
            class="home-plugin-bucket__bar"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            :fill="b.fill"
            rx="1.5"
          />
        </svg>
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
      v-if="chartPanel === 'local_spark' && showLocalSpark"
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
            stroke="#ea580c"
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
}
.home-plugin-charts__toolbar-controls .home-plugin-charts__draw-toggle {
  flex: 0 0 auto;
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
  font-weight: 650;
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
  min-height: 30px;
  font-size: 12px;
  padding-top: 4px;
  padding-bottom: 4px;
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
.home-plugin-charts__viz .home-plugin-spark:not(.home-plugin-spark--hourly) {
  height: auto;
  min-height: 108px;
  flex: 1 1 auto;
}
.home-plugin-charts__viz .home-plugin-bucket__svg {
  min-height: 200px;
  max-height: min(360px, 52vh);
  max-width: 100%;
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
.home-plugin-bars__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(80px, 2.2fr) 36px;
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
.home-plugin-bars__track {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  overflow: hidden;
}
.home-plugin-bars__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), rgba(125, 211, 252, 0.75));
  min-width: 2px;
  transition: width 0.25s var(--ease, ease);
}
.home-plugin-bars__fill--duration {
  background: linear-gradient(90deg, #c2410c, rgba(251, 146, 60, 0.85));
}
.home-matcher-dur-log {
  border: 1px solid var(--border);
  border-radius: var(--radius-shell);
  background: var(--bg-elev);
  padding: 6px 8px;
  max-height: min(420px, 52vh);
  overflow: auto;
  box-sizing: border-box;
}
.home-matcher-dur-log__scroll {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  width: 100%;
}
.home-matcher-dur-log__head {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto auto;
  gap: 4px 10px;
  padding: 0 6px 4px;
  font-size: 0.72rem;
  width: 100%;
  box-sizing: border-box;
}
.home-matcher-dur-log__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  box-sizing: border-box;
}
.home-matcher-dur-log__row {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto auto;
  gap: 4px 10px;
  align-items: center;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  width: 100%;
  box-sizing: border-box;
}
.home-matcher-dur-log__time-axis {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto auto;
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
.home-matcher-dur-log__time-axis-label {
  font-weight: 650;
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
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.home-matcher-dur-log__ms {
  font-weight: 700;
  color: #fdba74;
  white-space: nowrap;
}
.home-matcher-dur-log__plugin {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background: rgba(239, 68, 68, 0.2);
  color: #fecaca;
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
  width: 8px;
  height: 8px;
  border-radius: 2px;
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
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

.home-plugin-bucket__svg {
  width: 100%;
  max-width: 100%;
  height: auto;
  min-height: 172px;
  max-height: 260px;
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
}

/* 无容器查询时的回退（整页窄屏） */
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
  font-weight: 650;
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
  background: linear-gradient(90deg, #f472b6, #fb7185);
}

.home-plugin-daily__leg-swatch--mat {
  background: linear-gradient(90deg, #d946ef, #e879f9);
}

.home-plugin-daily__svg-wrap {
  width: 100%;
  max-width: min(720px, 100%);
  margin: 0 auto;
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
  stroke: #f472b6;
}

.home-plugin-daily__line--mat {
  stroke: #d946ef;
}

.home-plugin-daily__dot {
  stroke: color-mix(in srgb, var(--panel) 82%, #1f2937 18%);
  stroke-width: 1px;
}

.home-plugin-daily__dot--msg {
  fill: #fdf2f8;
}

.home-plugin-daily__dot--mat {
  fill: #faf5ff;
}

html[data-theme="light"] .home-plugin-daily__line--msg {
  stroke: #db2777;
}

html[data-theme="light"] .home-plugin-daily__line--mat {
  stroke: #a21caf;
}

html[data-theme="light"] .home-plugin-daily__dot--msg {
  fill: #fff1f2;
  stroke: #fce7f3;
}

html[data-theme="light"] .home-plugin-daily__dot--mat {
  fill: #fdf4ff;
  stroke: #fae8ff;
}

.home-plugin-daily__bar--msg {
  fill: #f472b6;
}

.home-plugin-daily__bar--mat {
  fill: #d946ef;
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
  fill: #db2777;
}

html[data-theme="light"] .home-plugin-daily__bar--mat {
  fill: #a21caf;
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
</style>
