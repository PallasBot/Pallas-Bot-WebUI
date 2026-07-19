<script setup lang="ts">
import { computed, ref, watch } from "vue";

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

const props = defineProps<{
  pack: HourlyChartPack;
}>();

const HOURLY_AXIS_HOURS = Array.from({ length: 24 }, (_, i) => i);

const plotRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const hoverHour = ref<number | null>(null);
const tooltipX = ref(0);

watch(
  () => props.pack,
  () => {
    hoverHour.value = null;
  },
);

const hoverX = computed(() => {
  if (hoverHour.value == null) return null;
  return props.pack.left + (hoverHour.value / 23) * props.pack.innerW;
});

const hoverRows = computed(() => {
  if (hoverHour.value == null) return [];
  const h = hoverHour.value;
  return props.pack.layers
    .map((ly) => ({
      label: ly.label,
      color: ly.color,
      value: ly.hours?.[h] ?? 0,
    }))
    .filter((r) => r.value > 0);
});

function onPlotMove(ev: PointerEvent) {
  const svg = svgRef.value;
  const wrap = plotRef.value;
  const p = props.pack;
  if (!svg || !wrap) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  const ratio = (svgPt.x - p.left) / Math.max(1, p.innerW);
  hoverHour.value = Math.max(0, Math.min(23, Math.round(ratio * 23)));
  const rect = wrap.getBoundingClientRect();
  const pad = 12;
  tooltipX.value = Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left));
}

function onPlotLeave() {
  hoverHour.value = null;
}
</script>

<template>
  <div
    ref="plotRef"
    class="home-plugin-hourly-chart home-plugin-hourly-chart--interactive"
    @pointermove="onPlotMove"
    @pointerleave="onPlotLeave"
  >
    <svg
      ref="svgRef"
      class="home-plugin-hourly-chart__svg home-plugin-bucket__svg"
      :viewBox="`0 0 ${pack.W} ${pack.H}`"
      preserveAspectRatio="xMidYMid meet"
      overflow="hidden"
      role="img"
      aria-label="今日各小时折线图"
    >
      <line
        v-for="(gy, gi) in pack.gridYs"
        :key="`hg-${gi}`"
        class="home-plugin-bucket__grid"
        :x1="pack.left"
        :y1="gy"
        :x2="pack.left + pack.innerW"
        :y2="gy"
      />
      <line
        class="home-plugin-bucket__axis"
        :x1="pack.left"
        :y1="pack.bottom"
        :x2="pack.left + pack.innerW"
        :y2="pack.bottom"
      />
      <text
        v-for="(tk, ti) in pack.yTicks"
        :key="`hyt-${ti}`"
        class="home-plugin-bucket__ytick"
        :x="4"
        :y="tk.y + 4"
      >{{ tk.t }}</text>
      <polyline
        v-for="(ly, idx) in pack.layers"
        :key="idx"
        class="home-plugin-chart-line"
        fill="none"
        :stroke="ly.color"
        stroke-opacity="0.92"
        :points="ly.poly"
      />
      <line
        v-if="hoverX != null"
        class="home-plugin-bucket__cursor"
        :x1="hoverX"
        :y1="10"
        :x2="hoverX"
        :y2="pack.bottom"
      />
    </svg>
    <div
      v-if="hoverHour != null && hoverRows.length"
      class="home-plugin-chart-tooltip"
      :style="{ left: `${tooltipX}px` }"
    >
      <div class="home-plugin-chart-tooltip__hd">{{ hoverHour }} 时</div>
      <div
        v-for="row in hoverRows"
        :key="row.label"
        class="home-plugin-chart-tooltip__row"
      >
        <span
          class="home-plugin-chart-tooltip__dot"
          :style="{ background: row.color }"
        />
        <span class="home-plugin-chart-tooltip__label">{{ row.label }}</span>
        <span class="home-plugin-chart-tooltip__val">{{ row.value.toLocaleString() }}</span>
      </div>
    </div>
    <div
      class="home-plugin-hour-ticks muted"
      :style="{
        paddingLeft: `${(pack.left / pack.W) * 100}%`,
        paddingRight: `${((pack.W - pack.left - pack.innerW) / pack.W) * 100}%`,
      }"
    >
      <span
        v-for="hx in HOURLY_AXIS_HOURS"
        :key="hx"
      >{{ hx }}<span class="home-plugin-hour-ticks__unit">时</span></span>
    </div>
  </div>
</template>

<style scoped>
.home-plugin-hourly-chart {
  min-width: 0;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-plugin-hourly-chart--interactive {
  position: relative;
  touch-action: none;
}

.home-plugin-hourly-chart__svg {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
}

.home-plugin-hourly-chart__svg :deep(.home-plugin-bucket__grid) {
  stroke: color-mix(in srgb, var(--border) 88%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.home-plugin-hourly-chart__svg :deep(.home-plugin-bucket__axis) {
  stroke: color-mix(in srgb, var(--border-strong) 92%, var(--border) 8%);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.home-plugin-hourly-chart__svg :deep(.home-plugin-bucket__ytick) {
  font-size: 10px;
  font-weight: 600;
  fill: var(--text-muted);
}

.home-plugin-hourly-chart__svg :deep(.home-plugin-chart-line) {
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

.home-plugin-hour-ticks {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 0 1px;
  font-size: 10px;
  margin: 4px 0 0;
  min-width: 0;
  box-sizing: border-box;
}

.home-plugin-hour-ticks span {
  min-width: 0;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-plugin-hour-ticks__unit {
  font-size: 10px;
  opacity: 0.72;
}
</style>
