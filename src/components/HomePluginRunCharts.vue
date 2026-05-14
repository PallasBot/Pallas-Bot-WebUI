<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ApiCallNamedSeries, PluginMatcherNamedSeries, PluginRunStatsRow, PluginRow } from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { matcherPluginDisplayName } from "@/utils/pluginDisplayLabel";

const COLORS = ["#ea580c", "#fb923c", "#f97316", "#fdba74", "#c2410c", "#fed7aa", "#fb7185", "#fbbf24"];

/** 今日各小时图横轴刻度 0–23（本地自然日） */
const HOURLY_AXIS_HOURS = Array.from({ length: 24 }, (_, i) => i);

const CHART_SEL_KEY = "pallas_home_chart_sel_v1";
const CHART_PANEL_KEY = "pallas_home_chart_panel_v1";

type ChartPanelId =
  | "plugins_top"
  | "api_hourly"
  | "api_bucket"
  | "matcher_hourly"
  | "matcher_bucket"
  | "matcher_err_hourly"
  | "matcher_err_bucket"
  | "local_spark";

const PANEL_ORDER: ChartPanelId[] = [
  "plugins_top",
  "api_hourly",
  "api_bucket",
  "matcher_hourly",
  "matcher_bucket",
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
  matcherHistoryBucketSec?: number;
}>();

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
  const keys = rows.filter((r) => (r.points?.length ?? 0) > 0).map((r) => r.plugin);
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

const topPlugins = computed(() =>
  [...props.plugins].sort((a, b) => b.runs_today - a.runs_today).filter((p) => p.runs_today > 0).slice(0, 8),
);

const maxRuns = computed(() => Math.max(1, ...topPlugins.value.map((p) => p.runs_today)));

function fmtBucketSec(sec: number | undefined): string {
  const s = sec ?? 300;
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} 小时`;
  if (s >= 60 && s % 60 === 0) return `${s / 60} 分钟`;
  return `${s} 秒`;
}

type Layer = { label: string; color: string; poly: string };

function buildLayers(
  rows: { label: string; points: { at: number; total: number }[] }[],
): Layer[] | null {
  if (!rows.length) return null;
  let minT = Infinity;
  let maxT = -Infinity;
  let maxV = 0;
  for (const row of rows) {
    for (const p of row.points) {
      const t = p.at * 1000;
      minT = Math.min(minT, t);
      maxT = Math.max(maxT, t);
      maxV = Math.max(maxV, p.total);
    }
  }
  if (!Number.isFinite(minT) || maxT <= minT) return null;
  maxV = Math.max(maxV, 1);
  const dr = maxT - minT;
  const w = 100;
  const h = 44;
  return rows.map((row, i) => ({
    label: row.label,
    color: COLORS[i % COLORS.length]!,
    poly: row.points
      .map((p) => {
        const x = ((p.at * 1000 - minT) / dr) * w;
        const y = h - (p.total / maxV) * (h - 8) - 4;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" "),
  }));
}

function buildHourlyLayers(rows: { label: string; hours: number[] }[]): Layer[] | null {
  if (!rows.length) return null;
  const maxV = Math.max(1, ...rows.flatMap((r) => r.hours));
  const w = 100;
  const xInset = 1.5;
  const xSpan = w - 2 * xInset;
  const hb = 48;
  return rows.map((row, i) => ({
    label: row.label,
    color: COLORS[i % COLORS.length]!,
    poly: row.hours
      .map((v, h) => {
        const x = xInset + (h / 23) * xSpan;
        const y = hb - (v / maxV) * (hb - 8) - 4;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" "),
  }));
}

const apiLayers = computed(() => {
  const rows = (props.apiHistoryByApi ?? [])
    .filter((s) => selectedApiKeys.value.includes(s.api) && (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.api, points: s.points }));
  return buildLayers(rows);
});

const hourlyApiLayers = computed(() => {
  const rows = (props.apiHistoryByApi ?? [])
    .filter((s) => selectedApiKeys.value.includes(s.api) && (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.api, hours: aggregateLocalToday(s.points) }));
  return buildHourlyLayers(rows);
});

const matcherRunLayers = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherRunsByPlugin ?? [])
    .filter((s) => selectedMatcherKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: matcherPluginDisplayName(s.plugin, meta),
      points: s.points,
    }));
  return buildLayers(rows);
});

const hourlyMatcherLayers = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherRunsByPlugin ?? [])
    .filter((s) => selectedMatcherKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: matcherPluginDisplayName(s.plugin, meta),
      hours: aggregateLocalToday(s.points),
    }));
  return buildHourlyLayers(rows);
});

const matcherErrLayers = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherErrorsByPlugin ?? [])
    .filter((s) => selectedMatcherErrKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: matcherPluginDisplayName(s.plugin, meta),
      points: s.points,
    }));
  return buildLayers(rows);
});

const hourlyMatcherErrLayers = computed(() => {
  const meta = props.pluginsMeta ?? undefined;
  const rows = (props.matcherErrorsByPlugin ?? [])
    .filter((s) => selectedMatcherErrKeys.value.includes(s.plugin) && (s.points?.length ?? 0) > 0)
    .map((s) => ({
      label: `${matcherPluginDisplayName(s.plugin, meta)} · 异常`,
      hours: aggregateLocalToday(s.points),
    }));
  return buildHourlyLayers(rows);
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
  () => !matcherRunLayers.value?.length && !!sparkPoly.value,
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

const chartPanel = ref<ChartPanelId>("plugins_top");
const panelPickReady = ref(false);
const chartsDrawExpanded = ref(loadChartsDrawExpanded());

function toggleChartsDraw() {
  chartsDrawExpanded.value = !chartsDrawExpanded.value;
  saveChartsDrawExpanded(chartsDrawExpanded.value);
}

const panelAvailability = computed(() => ({
  plugins_top: true,
  api_hourly: apiCandidates.value.length > 0,
  api_bucket: apiCandidates.value.length > 0,
  matcher_hourly: matcherRunCandidates.value.length > 0,
  matcher_bucket: matcherRunCandidates.value.length > 0,
  matcher_err_hourly: matcherErrCandidates.value.length > 0,
  matcher_err_bucket: matcherErrCandidates.value.length > 0,
  local_spark: showLocalSpark.value,
}));

const panelOptions = computed(() => {
  const labels: Record<ChartPanelId, string> = {
    plugins_top: "插件今日次数（Top）",
    api_hourly: "协议 API · 今日各小时",
    api_bucket: "协议 API · 按时间桶",
    matcher_hourly: "Matcher · 今日各小时",
    matcher_bucket: "Matcher · 按时间桶",
    matcher_err_hourly: "Matcher 异常 · 今日各小时",
    matcher_err_bucket: "Matcher 异常 · 按时间桶",
    local_spark: "Matcher 累计（本机采样）",
  };
  return PANEL_ORDER.map((id) => ({
    id,
    label: labels[id],
    available: panelAvailability.value[id],
  }));
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
</script>

<template>
  <div class="home-plugin-charts">
    <div class="home-plugin-charts__toolbar">
      <div class="home-plugin-charts__toolbar-main">
        <label
          class="home-plugin-charts__toolbar-label muted"
          for="home-chart-panel-sel"
        ><span class="panel__title-ico panel__title-ico--sm" aria-hidden="true">◧</span>图表视图</label>
        <select
          id="home-chart-panel-sel"
          v-model="chartPanel"
          class="sel home-plugin-charts__pick"
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
      </div>
      <button
        type="button"
        class="home-plugin-charts__draw-toggle"
        :aria-expanded="chartsDrawExpanded"
        aria-controls="home-plugin-charts-draw"
        @click="toggleChartsDraw"
      >
        <span
          class="home-plugin-charts__draw-toggle-ico"
          aria-hidden="true"
        >{{ chartsDrawExpanded ? "▼" : "▶" }}</span>
        <span>{{ chartsDrawExpanded ? "收起绘图" : "展开绘图" }}</span>
      </button>
    </div>

    <div
      id="home-plugin-charts-draw"
      v-show="chartsDrawExpanded"
      class="home-plugin-charts__draw"
    >
    <div
      v-if="chartPanel === 'plugins_top'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        插件今日次数（Top）
      </div>
      <p
        v-if="busy"
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
        class="home-plugin-bars"
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
          <span class="home-plugin-bars__val">{{ p.runs_today }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="chartPanel === 'api_hourly'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        协议 API · 今日各小时（本地日）
      </div>
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
      <div
        v-if="hourlyApiLayers?.length"
        class="home-plugin-multi"
      >
        <svg
          class="home-plugin-spark home-plugin-spark--hourly"
          viewBox="0 0 100 52"
          preserveAspectRatio="none"
          overflow="hidden"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in hourlyApiLayers"
            :key="idx"
            class="home-plugin-chart-line"
            fill="none"
            :stroke="ly.color"
            stroke-opacity="0.92"
            :points="ly.poly"
          />
        </svg>
        <div class="home-plugin-hour-ticks muted">
          <span
            v-for="hx in HOURLY_AXIS_HOURS"
            :key="hx"
          >{{ hx }}</span>
        </div>
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyApiLayers"
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

    <div
      v-if="chartPanel === 'api_bucket'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        协议 API（服务端 · 按时间桶）
      </div>
      <p class="muted home-plugin-charts__hint">
        桶宽 {{ fmtBucketSec(apiHistoryBucketSec) }}；纵轴为所选曲线在窗内的峰值归一。勾选下方接口名。
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
      <div
        v-if="apiLayers?.length"
        class="home-plugin-multi"
      >
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in apiLayers"
            :key="idx"
            class="home-plugin-chart-line"
            fill="none"
            :stroke="ly.color"
            stroke-opacity="0.92"
            :points="ly.poly"
          />
        </svg>
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in apiLayers"
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

    <div
      v-if="chartPanel === 'matcher_hourly'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher · 今日各小时（本地日）
      </div>
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
      <div
        v-if="hourlyMatcherLayers?.length"
        class="home-plugin-multi"
      >
        <svg
          class="home-plugin-spark home-plugin-spark--hourly"
          viewBox="0 0 100 52"
          preserveAspectRatio="none"
          overflow="hidden"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in hourlyMatcherLayers"
            :key="idx"
            class="home-plugin-chart-line"
            fill="none"
            :stroke="ly.color"
            stroke-opacity="0.92"
            :points="ly.poly"
          />
        </svg>
        <div class="home-plugin-hour-ticks muted">
          <span
            v-for="hx in HOURLY_AXIS_HOURS"
            :key="hx"
          >{{ hx }}</span>
        </div>
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyMatcherLayers"
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

    <div
      v-if="chartPanel === 'matcher_bucket'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher 执行（服务端 · 按时间桶）
      </div>
      <p class="muted home-plugin-charts__hint">
        桶宽 {{ fmtBucketSec(matcherHistoryBucketSec) }}；每曲线为该插件 Matcher 每桶执行次数。勾选见上类视图或下方。
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
      <div
        v-if="matcherRunLayers?.length"
        class="home-plugin-multi"
      >
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in matcherRunLayers"
            :key="idx"
            class="home-plugin-chart-line"
            fill="none"
            :stroke="ly.color"
            stroke-opacity="0.92"
            :points="ly.poly"
          />
        </svg>
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in matcherRunLayers"
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

    <div
      v-if="chartPanel === 'matcher_err_hourly'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher 异常 · 今日各小时（本地日）
      </div>
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
      <div
        v-if="hourlyMatcherErrLayers?.length"
        class="home-plugin-multi"
      >
        <svg
          class="home-plugin-spark home-plugin-spark--hourly"
          viewBox="0 0 100 52"
          preserveAspectRatio="none"
          overflow="hidden"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in hourlyMatcherErrLayers"
            :key="idx"
            class="home-plugin-chart-line"
            fill="none"
            :stroke="ly.color"
            stroke-opacity="0.92"
            :points="ly.poly"
          />
        </svg>
        <div class="home-plugin-hour-ticks muted">
          <span
            v-for="hx in HOURLY_AXIS_HOURS"
            :key="hx"
          >{{ hx }}</span>
        </div>
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in hourlyMatcherErrLayers"
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

    <div
      v-if="chartPanel === 'matcher_err_bucket'"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher 异常（服务端 · 按时间桶）
      </div>
      <p class="muted home-plugin-charts__hint">
        与上同桶；勾选下方插件名。
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
      <div
        v-if="matcherErrLayers?.length"
        class="home-plugin-multi"
      >
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in matcherErrLayers"
            :key="idx"
            class="home-plugin-chart-line"
            fill="none"
            :stroke="ly.color"
            stroke-opacity="0.92"
            :points="ly.poly"
          />
        </svg>
        <div class="home-plugin-legend">
          <span
            v-for="(ly, idx) in matcherErrLayers"
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

    <div
      v-if="chartPanel === 'local_spark' && showLocalSpark"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher 今日累计（本机刷新采样）
      </div>
      <p class="muted home-plugin-charts__hint">
        无服务端时间序列时显示：在总览点击「刷新」或切换 Bot 时写入浏览器本地快照。
      </p>
      <div class="home-plugin-spark-wrap">
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
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
</template>

<style scoped>
.home-plugin-charts {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.home-plugin-charts__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  padding: 2px 0 4px;
}
.home-plugin-charts__toolbar-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  flex: 1;
  min-width: 0;
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
.home-plugin-charts__draw {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.home-plugin-charts__toolbar-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.home-plugin-charts__pick {
  min-width: min(100%, 320px);
  max-width: 100%;
  flex: 1;
  min-height: var(--ui-sel-min-h);
  padding: var(--ui-ctrl-pad-y) var(--ui-sel-arrow-pad) var(--ui-ctrl-pad-y) var(--ui-ctrl-pad-x);
  font-size: var(--ui-ctrl-font);
}
.home-plugin-charts__block {
  min-width: 0;
}
.home-plugin-charts__caption {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.home-plugin-charts__hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
}
.home-plugin-charts__hint code {
  font-size: 11px;
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
}
.home-plugin-spark {
  width: 100%;
  height: 72px;
  display: block;
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
}
.home-plugin-spark-meta {
  font-size: 11px;
  margin-top: 4px;
}

.home-plugin-chart-line {
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

/* 按「图表区块实际宽度」断行，避免宽视口 + 窄内容列时仍横向挤压 */
@container (max-width: 640px) {
  .home-plugin-charts__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .home-plugin-charts__toolbar-main {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .home-plugin-charts__toolbar-label {
    width: 100%;
  }

  .home-plugin-charts__pick {
    width: 100%;
    min-width: 0;
    flex: 0 0 auto;
    box-sizing: border-box;
  }

  .home-plugin-charts__draw-toggle {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }
}

/* 无容器查询时的回退（整页窄屏） */
@media (max-width: 640px) {
  .home-plugin-charts__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .home-plugin-charts__toolbar-main {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .home-plugin-charts__toolbar-label {
    width: 100%;
  }

  .home-plugin-charts__pick {
    width: 100%;
    min-width: 0;
    flex: 0 0 auto;
    box-sizing: border-box;
  }

  .home-plugin-charts__draw-toggle {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }
}
</style>
