<script setup lang="ts">
import { computed } from "vue";
import type { ApiCallNamedSeries, PluginMatcherNamedSeries, PluginRunStatsRow } from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";

const COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#4ade80", "#fbbf24", "#94a3b8", "#fb7185", "#2dd4bf"];

const props = defineProps<{
  plugins: PluginRunStatsRow[];
  series: PluginRunSample[];
  busy: boolean;
  apiHistoryByApi?: ApiCallNamedSeries[];
  apiHistoryBucketSec?: number;
  matcherRunsByPlugin?: PluginMatcherNamedSeries[];
  matcherErrorsByPlugin?: PluginMatcherNamedSeries[];
  matcherHistoryBucketSec?: number;
}>();

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

const apiLayers = computed(() => {
  const rows = (props.apiHistoryByApi ?? [])
    .filter((s) => (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.api, points: s.points }));
  return buildLayers(rows);
});

const matcherRunLayers = computed(() => {
  const rows = (props.matcherRunsByPlugin ?? [])
    .filter((s) => (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.plugin, points: s.points }));
  return buildLayers(rows);
});

const matcherErrLayers = computed(() => {
  const rows = (props.matcherErrorsByPlugin ?? [])
    .filter((s) => (s.points?.length ?? 0) > 0)
    .map((s) => ({ label: s.plugin, points: s.points }));
  return buildLayers(rows);
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
</script>

<template>
  <div class="home-plugin-charts">
    <div class="home-plugin-charts__block">
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
          >{{ p.name }}</span>
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
      v-if="apiLayers?.length"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        协议 API（服务端 · 按接口）
      </div>
      <p class="muted home-plugin-charts__hint">
        桶宽 {{ fmtBucketSec(apiHistoryBucketSec) }}；各曲线为单接口每桶成功次数，纵轴为全局峰值归一。
      </p>
      <div class="home-plugin-multi">
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in apiLayers"
            :key="idx"
            fill="none"
            :stroke="ly.color"
            stroke-width="1.35"
            stroke-opacity="0.92"
            vector-effect="non-scaling-stroke"
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
    </div>

    <div
      v-if="matcherRunLayers?.length"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher 执行（服务端 · 按插件）
      </div>
      <p class="muted home-plugin-charts__hint">
        桶宽 {{ fmtBucketSec(matcherHistoryBucketSec) }}；每曲线为该插件 Matcher 每桶执行次数（与 runs 累计口径一致）。
      </p>
      <div class="home-plugin-multi">
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in matcherRunLayers"
            :key="idx"
            fill="none"
            :stroke="ly.color"
            stroke-width="1.35"
            stroke-opacity="0.92"
            vector-effect="non-scaling-stroke"
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
    </div>

    <div
      v-if="matcherErrLayers?.length"
      class="home-plugin-charts__block"
    >
      <div class="home-plugin-charts__caption">
        Matcher 异常（服务端 · 按插件）
      </div>
      <p class="muted home-plugin-charts__hint">
        与上同桶；仅统计 run 结束时带 exception 的次数。
      </p>
      <div class="home-plugin-multi">
        <svg
          class="home-plugin-spark"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-for="(ly, idx) in matcherErrLayers"
            :key="idx"
            fill="none"
            :stroke="ly.color"
            stroke-width="1.35"
            stroke-opacity="0.92"
            vector-effect="non-scaling-stroke"
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
    </div>

    <div
      v-if="showLocalSpark"
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
            fill="none"
            stroke="var(--accent)"
            stroke-width="1.4"
            vector-effect="non-scaling-stroke"
            :points="sparkPoly"
          />
        </svg>
        <div class="home-plugin-spark-meta muted">
          <span v-if="series.length">末次 {{ lastLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-plugin-charts {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
.home-plugin-charts__empty {
  margin: 0;
  font-size: 13px;
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
  max-width: 140px;
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
</style>
