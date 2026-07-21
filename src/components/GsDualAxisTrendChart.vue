<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ConsoleDailyStatRow } from "@/api/pallasTypes";
import {
  buildGsTrendChartPack,
  fmtAxisCount,
} from "@/utils/gsTrendChart";

const props = withDefaults(
  defineProps<{
    rows: ConsoleDailyStatRow[];
    emptyText?: string;
    busy?: boolean;
    showSummary?: boolean;
    chartUid?: string;
  }>(),
  {
    emptyText: "暂无持久化数据，请保持 Bot 运行并跨日写入。",
    busy: false,
    showSummary: true,
    chartUid: "",
  },
);

const uid = props.chartUid || `gs-trend-${Math.random().toString(36).slice(2, 9)}`;
const plotRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const hoverIndex = ref<number | null>(null);
const tooltipX = ref(0);
const animKey = ref(0);

const pack = computed(() => buildGsTrendChartPack(props.rows));

watch(
  () => props.rows,
  () => {
    animKey.value += 1;
    hoverIndex.value = null;
  },
  { deep: true },
);

const monthSummary = computed(() => {
  let sent = 0;
  let received = 0;
  let matcher = 0;
  let api = 0;
  for (const row of props.rows) {
    sent += Number(row.sent) || 0;
    received += Number(row.received) || 0;
    matcher += Number(row.matcher_runs) || 0;
    api += Number(row.api_calls) || 0;
  }
  return { sent, received, matcher, api };
});

const hoverRow = computed(() => {
  if (hoverIndex.value == null || !pack.value) return null;
  return pack.value.rows[hoverIndex.value] ?? null;
});

const hoverX = computed(() => {
  if (hoverIndex.value == null || !pack.value) return null;
  return pack.value.xAt(hoverIndex.value);
});

function onPlotMove(ev: PointerEvent) {
  const svg = svgRef.value;
  const p = pack.value;
  const wrap = plotRef.value;
  if (!svg || !p || !wrap) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  const ratio = (svgPt.x - p.left) / p.innerW;
  const idx = Math.round(ratio * (p.rows.length - 1));
  hoverIndex.value = Math.max(0, Math.min(p.rows.length - 1, idx));
  const rect = wrap.getBoundingClientRect();
  const pad = 12;
  tooltipX.value = Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left));
}

function onPlotLeave() {
  hoverIndex.value = null;
}

function fmtDateLabel(date: string): string {
  if (date.length >= 10) return date.slice(5);
  return date;
}

function rowValue(row: ConsoleDailyStatRow, key: "sent" | "received" | "matcher" | "api"): number {
  if (key === "sent") return Number(row.sent) || 0;
  if (key === "received") return Number(row.received) || 0;
  if (key === "matcher") return Number(row.matcher_runs) || 0;
  return Number(row.api_calls) || 0;
}
</script>

<template>
  <div class="gs-trend-chart">
    <div
      v-if="showSummary && (monthSummary.sent > 0 || monthSummary.received > 0 || monthSummary.matcher > 0)"
      class="gs-trend-chart__summary muted"
    >
      <span>发送 {{ monthSummary.sent.toLocaleString() }} 条</span>
      <span>接收 {{ monthSummary.received.toLocaleString() }} 条</span>
      <span>Matcher {{ monthSummary.matcher.toLocaleString() }} 次</span>
      <span v-if="monthSummary.api > 0">API {{ monthSummary.api.toLocaleString() }} 次</span>
    </div>

    <p
      v-if="busy && !pack"
      class="muted gs-trend-chart__empty"
    >
      加载中…
    </p>
    <p
      v-else-if="!pack"
      class="muted gs-trend-chart__empty"
    >
      {{ emptyText }}
    </p>

    <template v-else>
      <div
        ref="plotRef"
        class="gs-trend-chart__plot"
        @pointermove="onPlotMove"
        @pointerleave="onPlotLeave"
      >
        <svg
          ref="svgRef"
          class="gs-trend-chart__svg"
          :viewBox="`0 0 ${pack.W} ${pack.H}`"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          role="img"
          :aria-label="`消息与 Matcher 按日趋势，共 ${pack.rows.length} 天`"
        >
          <defs>
            <template
              v-for="s in pack.series"
              :key="`${uid}-grad-${s.def.id}`"
            >
              <linearGradient
                :id="`${uid}-area-${s.def.id}`"
                gradientUnits="userSpaceOnUse"
                :x1="pack.left"
                :y1="pack.bottom"
                :x2="pack.left"
                :y2="pack.top"
              >
                <stop
                  offset="0%"
                  :stop-color="s.def.color"
                  stop-opacity="0"
                />
                <stop
                  offset="100%"
                  :stop-color="s.def.color"
                  stop-opacity="0.16"
                />
              </linearGradient>
            </template>
          </defs>

          <line
            v-for="(gy, gi) in pack.gridYs"
            :key="`g-${gi}`"
            class="gs-trend-chart__grid"
            :x1="pack.left"
            :y1="gy"
            :x2="pack.left + pack.innerW"
            :y2="gy"
          />

          <text
            v-for="(tk, ti) in pack.leftTicks"
            :key="`lt-${ti}`"
            class="gs-trend-chart__axis gs-trend-chart__axis--left"
            :x="8"
            :y="tk.y + 4"
          >{{ tk.t }}</text>
          <text
            v-for="(tk, ti) in pack.rightTicks"
            :key="`rt-${ti}`"
            class="gs-trend-chart__axis gs-trend-chart__axis--right"
            :x="pack.W - 8"
            :y="tk.y + 4"
          >{{ tk.t }}</text>
          <text
            v-for="(xt, xi) in pack.xTicks"
            :key="`xt-${xi}`"
            class="gs-trend-chart__axis gs-trend-chart__axis--x"
            :x="xt.x"
            :y="pack.H - 10"
          >{{ xt.t }}</text>

          <template
            v-for="s in pack.series"
            :key="`${uid}-area-${s.def.id}-${animKey}`"
          >
            <path
              class="gs-trend-chart__area"
              :d="s.areaD"
              :fill="`url(#${uid}-area-${s.def.id})`"
              :style="{ '--gs-series-color': s.def.color }"
            />
          </template>

          <template
            v-for="s in pack.series"
            :key="`${uid}-line-${s.def.id}-${animKey}`"
          >
            <path
              class="gs-trend-chart__line gs-trend-chart__line--animate"
              :d="s.pathD"
              fill="none"
              :stroke="s.def.color"
            />
          </template>

          <template v-if="hoverIndex != null">
            <line
              class="gs-trend-chart__crosshair"
              :x1="hoverX ?? 0"
              :y1="pack.top"
              :x2="hoverX ?? 0"
              :y2="pack.bottom"
            />
          </template>

          <template
            v-for="s in pack.series"
            :key="`${uid}-dots-${s.def.id}`"
          >
            <circle
              v-for="(p, di) in s.points"
              :key="`${s.def.id}-${di}`"
              class="gs-trend-chart__dot"
              :class="{ 'gs-trend-chart__dot--active': hoverIndex === di }"
              :cx="p.x"
              :cy="p.y"
              :r="hoverIndex === di ? 6 : 4"
              :fill="s.def.color"
              :stroke="hoverIndex === di ? 'var(--panel, #fff)' : 'transparent'"
              stroke-width="2"
            />
          </template>

          <rect
            class="gs-trend-chart__hit"
            :x="pack.left"
            :y="pack.top"
            :width="pack.innerW"
            :height="pack.innerH"
            fill="transparent"
          />
        </svg>

        <div
          v-if="hoverRow && hoverIndex != null"
          class="gs-trend-chart__tooltip"
          :style="{ left: `${tooltipX}px` }"
          role="status"
        >
          <div class="gs-trend-chart__tooltip-date">
            {{ fmtDateLabel(hoverRow.date) }}
          </div>
          <div
            v-for="s in pack.series"
            :key="`tip-${s.def.id}`"
            class="gs-trend-chart__tooltip-row"
          >
            <i
              class="gs-trend-chart__tooltip-dot"
              :style="{ background: s.def.color }"
              aria-hidden="true"
            />
            <span class="gs-trend-chart__tooltip-label">{{ s.def.label }}</span>
            <span class="gs-trend-chart__tooltip-val">
              {{ fmtAxisCount(rowValue(hoverRow, s.def.id)) }}{{ s.def.unit }}
            </span>
          </div>
        </div>
      </div>

      <div class="gs-trend-chart__legend muted">
        <span
          v-for="s in pack.series"
          :key="`leg-${s.def.id}`"
          class="gs-trend-chart__leg-item"
        >
          <i
            class="gs-trend-chart__leg-swatch"
            :style="{ background: s.def.color }"
            aria-hidden="true"
          />
          {{ s.def.label }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.gs-trend-chart {
  min-width: 0;
  width: 100%;
}

.gs-trend-chart__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0 0 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  width: 100%;
}

.gs-trend-chart__empty {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
}

.gs-trend-chart__plot {
  position: relative;
  width: 100%;
  min-width: 0;
  touch-action: none;
}

.gs-trend-chart__svg {
  display: block;
  width: 100%;
  height: auto;
  min-height: 220px;
  max-height: 320px;
}

.gs-trend-chart__grid {
  stroke: color-mix(in srgb, var(--border) 72%, transparent);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 2 6;
}

.gs-trend-chart__axis {
  fill: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-sans, system-ui);
}

.gs-trend-chart__axis--left {
  text-anchor: start;
}

.gs-trend-chart__axis--right {
  text-anchor: end;
}

.gs-trend-chart__axis--x {
  text-anchor: middle;
}

.gs-trend-chart__area {
  opacity: 0;
  animation: gs-trend-area-in 0.65s ease forwards;
}

.gs-trend-chart__line {
  stroke-width: 2.25px;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.gs-trend-chart__line--animate {
  stroke-dasharray: 2400;
  stroke-dashoffset: 2400;
  animation: gs-trend-line-draw 1.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.gs-trend-chart__crosshair {
  stroke: color-mix(in srgb, var(--text-muted) 55%, transparent);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 4 3;
  pointer-events: none;
}

.gs-trend-chart__dot {
  transition: r 0.15s ease, stroke 0.15s ease;
  pointer-events: none;
}

.gs-trend-chart__hit {
  cursor: crosshair;
}

.gs-trend-chart__tooltip {
  position: absolute;
  top: 6px;
  z-index: 2;
  transform: translateX(-50%);
  min-width: 148px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--panel, #fff) 92%, transparent);
  box-shadow: var(--shadow-md, 0 8px 24px rgba(15, 23, 42, 0.12));
  pointer-events: none;
  animation: gs-trend-tip-in 0.16s ease;
}

.gs-trend-chart__tooltip-date {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text);
}

.gs-trend-chart__tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1.45;
}

.gs-trend-chart__tooltip-row + .gs-trend-chart__tooltip-row {
  margin-top: 3px;
}

.gs-trend-chart__tooltip-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.gs-trend-chart__tooltip-label {
  flex: 1 1 auto;
  color: var(--text-muted);
}

.gs-trend-chart__tooltip-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.gs-trend-chart__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 18px;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
}

.gs-trend-chart__leg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gs-trend-chart__leg-swatch {
  width: 14px;
  height: 4px;
  border-radius: 999px;
  flex-shrink: 0;
}

@keyframes gs-trend-line-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes gs-trend-area-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes gs-trend-tip-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
