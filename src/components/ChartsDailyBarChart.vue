<script setup lang="ts">
import { computed, ref, watch } from "vue";

export type ChartsDailyBarPoint = {
  date: string;
  value: number;
  label?: string;
};

const props = withDefaults(
  defineProps<{
    points: ChartsDailyBarPoint[];
    title?: string;
    unit?: string;
    accent?: string;
    emptyText?: string;
  }>(),
  {
    title: "",
    unit: "",
    accent: "#ea580c",
    emptyText: "所选范围暂无持久化数据",
  },
);

const plotRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const hoverIndex = ref<number | null>(null);
const tooltipX = ref(0);

const pack = computed(() => {
  const pts = props.points.filter((p) => p.date);
  if (!pts.length) return null;
  const values = pts.map((p) => Math.max(0, Number(p.value) || 0));
  const maxV = Math.max(...values, 1);
  const W = 640;
  const H = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const left = padL;
  const bottom = padT + innerH;
  const n = pts.length;
  const gap = n > 20 ? 3 : n > 14 ? 4 : 6;
  const barW = Math.max(5, (innerW - gap * (n - 1)) / n);
  const bars = pts.map((p, i) => {
    const v = Math.max(0, Number(p.value) || 0);
    const h = (v / maxV) * innerH;
    const x = left + i * (barW + gap);
    const dayLabel = p.label ?? (p.date.length >= 10 ? String(Number(p.date.slice(8, 10))) : p.date);
    return { x, y: bottom - h, w: barW, h, v, dayLabel, date: p.date, cx: x + barW / 2 };
  });
  const yTicks = [
    { y: bottom, t: "0" },
    { y: bottom - innerH * 0.25, t: fmtTick(maxV * 0.25) },
    { y: bottom - innerH * 0.5, t: fmtTick(maxV * 0.5) },
    { y: bottom - innerH * 0.75, t: fmtTick(maxV * 0.75) },
    { y: padT, t: fmtTick(maxV) },
  ];
  const xTickIdx = pickTickIndices(n, 12);
  const xTicks = xTickIdx.map((i) => ({
    x: bars[i]!.cx,
    t: bars[i]!.dayLabel,
  }));
  return { W, H, left, bottom, innerH, bars, yTicks, xTicks, maxV, total: values.reduce((a, b) => a + b, 0), gap, barW };
});

watch(
  () => props.points,
  () => {
    hoverIndex.value = null;
  },
  { deep: true },
);

const hoverBar = computed(() => {
  if (hoverIndex.value == null || !pack.value) return null;
  return pack.value.bars[hoverIndex.value] ?? null;
});

function fmtTick(v: number): string {
  const n = Math.max(0, v);
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function pickTickIndices(n: number, maxTicks: number): number[] {
  if (n <= 1) return [0];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [0];
  const step = (n - 1) / (maxTicks - 1);
  for (let k = 1; k < maxTicks - 1; k++) {
    out.push(Math.min(n - 1, Math.round(k * step)));
  }
  out.push(n - 1);
  return [...new Set(out)].sort((a, b) => a - b);
}

function onPlotMove(ev: PointerEvent) {
  const svg = svgRef.value;
  const p = pack.value;
  const wrap = plotRef.value;
  if (!svg || !p || !wrap || !p.bars.length) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  const idx = Math.floor((svgPt.x - p.left) / (p.barW + p.gap));
  hoverIndex.value = Math.max(0, Math.min(p.bars.length - 1, idx));
  const rect = wrap.getBoundingClientRect();
  const pad = 12;
  tooltipX.value = Math.max(pad, Math.min(rect.width - pad, ev.clientX - rect.left));
}

function onPlotLeave() {
  hoverIndex.value = null;
}
</script>

<template>
  <div class="charts-daily-bar">
    <div
      v-if="title"
      class="charts-daily-bar__hd"
    >
      <h3 class="charts-daily-bar__title">{{ title }}</h3>
      <span
        v-if="pack"
        class="charts-daily-bar__total muted"
      >合计 {{ pack.total.toLocaleString() }}<template v-if="unit"> {{ unit }}</template></span>
    </div>
    <p
      v-if="!pack"
      class="muted charts-daily-bar__empty"
    >{{ emptyText }}</p>
    <div
      v-else
      ref="plotRef"
      class="charts-daily-bar__viz charts-daily-bar__viz--interactive"
      @pointermove="onPlotMove"
      @pointerleave="onPlotLeave"
    >
      <svg
        ref="svgRef"
        class="charts-daily-bar__svg"
        :viewBox="`0 0 ${pack.W} ${pack.H}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        :aria-label="`${title || '柱状图'}，共 ${pack.bars.length} 项`"
      >
        <line
          v-for="(gy, gi) in [0, 0.25, 0.5, 0.75, 1]"
          :key="`g-${gi}`"
          class="charts-daily-bar__grid"
          :x1="pack.left"
          :y1="pack.bottom - gy * pack.innerH"
          :x2="pack.W - 12"
          :y2="pack.bottom - gy * pack.innerH"
        />
        <rect
          v-for="(bar, bi) in pack.bars"
          :key="bar.date"
          class="charts-daily-bar__bar"
          :class="{ 'charts-daily-bar__bar--active': hoverIndex === bi }"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          :fill="accent"
          rx="2"
        />
        <line
          v-if="hoverBar"
          class="charts-daily-bar__cursor"
          :x1="hoverBar.cx"
          :y1="16"
          :x2="hoverBar.cx"
          :y2="pack.bottom"
        />
        <text
          v-for="(tk, ti) in pack.yTicks"
          :key="`yt-${ti}`"
          class="charts-daily-bar__ytick"
          :x="4"
          :y="tk.y + 4"
        >{{ tk.t }}</text>
        <text
          v-for="(tk, ti) in pack.xTicks"
          :key="`xt-${ti}`"
          class="charts-daily-bar__xtick"
          :x="tk.x"
          :y="pack.H - 8"
          text-anchor="middle"
        >{{ tk.t }}</text>
      </svg>
      <div
        v-if="hoverBar"
        class="charts-daily-bar__tooltip"
        :style="{ left: `${tooltipX}px` }"
      >
        <div class="charts-daily-bar__tooltip-date">{{ hoverBar.date }}</div>
        <div class="charts-daily-bar__tooltip-val">
          {{ hoverBar.v.toLocaleString() }}<template v-if="unit"> {{ unit }}</template>
        </div>
      </div>
    </div>
  </div>
</template>
