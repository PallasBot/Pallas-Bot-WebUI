<script setup lang="ts">
import { computed, ref, watch } from "vue";

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

const props = defineProps<{
  pack: BucketBarPack;
  formatTime?: (sec: number) => string;
}>();

const plotRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const hoverIndex = ref<number | null>(null);
const tooltipX = ref(0);

watch(
  () => props.pack,
  () => {
    hoverIndex.value = null;
  },
);

const slotW = computed(() => {
  const nT = props.pack.timesSec.length;
  return nT > 0 ? props.pack.innerW / nT : 0;
});

const hoverTime = computed(() => {
  if (hoverIndex.value == null) return null;
  return props.pack.timesSec[hoverIndex.value] ?? null;
});

const hoverRows = computed(() => {
  if (hoverIndex.value == null) return [];
  const idx = hoverIndex.value;
  return props.pack.series
    .map((s) => ({ label: s.label, color: s.color, value: s.vals[idx] ?? 0 }))
    .filter((r) => r.value > 0);
});

const hoverX = computed(() => {
  if (hoverIndex.value == null) return null;
  return props.pack.left + (hoverIndex.value + 0.5) * slotW.value;
});

function formatTimeLabel(sec: number): string {
  if (props.formatTime) return props.formatTime(sec);
  const d = new Date(sec * 1000);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function onPlotMove(ev: PointerEvent) {
  const svg = svgRef.value;
  const wrap = plotRef.value;
  const p = props.pack;
  if (!svg || !wrap || !p.timesSec.length) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  const idx = Math.floor((svgPt.x - p.left) / Math.max(1, slotW.value));
  hoverIndex.value = Math.max(0, Math.min(p.timesSec.length - 1, idx));
  const rect = wrap.getBoundingClientRect();
  const pad = 12;
  tooltipX.value = Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left));
}

function onPlotLeave() {
  hoverIndex.value = null;
}
</script>

<template>
  <div
    ref="plotRef"
    class="home-plugin-bucket-chart home-plugin-bucket-chart--interactive"
    @pointermove="onPlotMove"
    @pointerleave="onPlotLeave"
  >
    <svg
      ref="svgRef"
      class="home-plugin-bucket-chart__svg home-plugin-bucket__svg"
      :viewBox="`0 0 ${pack.W} ${pack.H}`"
      preserveAspectRatio="xMidYMid meet"
      overflow="hidden"
      role="img"
      aria-label="时间桶柱状图"
    >
      <line
        v-for="(gy, gi) in pack.gridYs"
        :key="`bg-${gi}`"
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
        :key="`byt-${ti}`"
        class="home-plugin-bucket__ytick"
        :x="4"
        :y="tk.y + 4"
      >{{ tk.t }}</text>
      <text
        v-for="(xk, xi) in pack.xTicks"
        :key="`bxt-${xi}`"
        class="home-plugin-bucket__xtick"
        text-anchor="middle"
        :x="xk.x"
        :y="pack.H - 6"
      >{{ xk.t }}</text>
      <rect
        v-for="(b, bi) in pack.bars"
        :key="`bb-${bi}`"
        class="home-plugin-bucket__bar"
        :class="{ 'home-plugin-bucket__bar--active': hoverIndex != null }"
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        :fill="b.fill"
        rx="2.5"
      />
      <line
        v-if="hoverX != null"
        class="home-plugin-bucket__cursor"
        :x1="hoverX"
        :y1="pack.top"
        :x2="hoverX"
        :y2="pack.bottom"
      />
    </svg>
    <div
      v-if="hoverTime != null && hoverRows.length"
      class="home-plugin-chart-tooltip"
      :style="{ left: `${tooltipX}px` }"
    >
      <div class="home-plugin-chart-tooltip__hd">{{ formatTimeLabel(hoverTime) }}</div>
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
  </div>
</template>

<style scoped>
.home-plugin-bucket-chart {
  min-width: 0;
  width: 100%;
}

.home-plugin-bucket-chart__svg {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__grid) {
  stroke: color-mix(in srgb, var(--border) 88%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__axis) {
  stroke: color-mix(in srgb, var(--border-strong) 92%, var(--border) 8%);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__ytick),
.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__xtick) {
  font-size: 10px;
  font-weight: 600;
  fill: var(--text-muted);
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__bar) {
  transition: opacity 0.12s var(--ease);
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__bar--active) {
  opacity: 0.82;
  filter: brightness(1.1);
}
</style>
