<script setup lang="ts">
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

defineProps<{
  pack: BucketBarPack;
}>();
</script>

<template>
  <div class="home-plugin-bucket-chart">
    <svg
      class="home-plugin-bucket-chart__svg home-plugin-bucket__svg"
      :viewBox="`0 0 ${pack.W} ${pack.H}`"
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      aria-hidden="true"
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
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        :fill="b.fill"
        rx="1.5"
      />
    </svg>
  </div>
</template>

<style scoped>
.home-plugin-bucket-chart {
  min-width: 0;
  width: 100%;
  flex: 1 1 auto;
  min-height: 140px;
  display: flex;
  flex-direction: column;
}

.home-plugin-bucket-chart__svg {
  width: 100%;
  max-width: 100%;
  height: auto;
  min-height: 140px;
  aspect-ratio: 440 / 212;
  display: block;
  box-sizing: border-box;
  flex: 1 1 auto;
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

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__ytick) {
  font-size: 10px;
  font-weight: 600;
  fill: var(--text-muted);
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__xtick) {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-muted);
}

.home-plugin-bucket-chart__svg :deep(.home-plugin-bucket__bar) {
  opacity: 0.9;
}
</style>
