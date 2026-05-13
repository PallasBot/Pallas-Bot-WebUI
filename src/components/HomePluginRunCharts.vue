<script setup lang="ts">
import { computed } from "vue";
import type { PluginRunStatsRow } from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";

const props = defineProps<{
  plugins: PluginRunStatsRow[];
  series: PluginRunSample[];
  busy: boolean;
}>();

const topPlugins = computed(() =>
  [...props.plugins].sort((a, b) => b.runs_today - a.runs_today).filter((p) => p.runs_today > 0).slice(0, 8),
);

const maxRuns = computed(() => Math.max(1, ...topPlugins.value.map((p) => p.runs_today)));

const sparkPoly = computed(() => {
  const s = props.series;
  if (s.length < 2) return null;
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

    <div class="home-plugin-charts__block">
      <div class="home-plugin-charts__caption">
        Matcher 今日累计（本机刷新采样）
      </div>
      <p class="muted home-plugin-charts__hint">
        在总览点击「刷新」或切换 Bot 时会记录快照；用于观察趋势，非服务端持久化。
      </p>
      <p
        v-if="busy"
        class="muted home-plugin-charts__empty"
      >
        加载中…
      </p>
      <template v-else-if="sparkPoly">
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
      </template>
      <p
        v-else
        class="muted home-plugin-charts__empty"
      >
        至少成功刷新 2 次后可显示累计折线。
      </p>
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
.home-plugin-spark-wrap {
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
.home-plugin-spark-meta {
  font-size: 11px;
  margin-top: 4px;
}
</style>
