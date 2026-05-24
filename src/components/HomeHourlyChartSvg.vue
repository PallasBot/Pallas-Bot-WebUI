<script setup lang="ts">
export type HourlyChartLayer = { label: string; color: string; poly: string };

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

defineProps<{
  pack: HourlyChartPack;
}>();

const HOURLY_AXIS_HOURS = Array.from({ length: 24 }, (_, i) => i);
</script>

<template>
  <div class="home-plugin-hourly-chart">
    <svg
      class="home-plugin-hourly-chart__svg home-plugin-bucket__svg"
      :viewBox="`0 0 ${pack.W} ${pack.H}`"
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      aria-hidden="true"
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
    </svg>
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
  font-size: 8px;
  margin: 2px 0 0;
  letter-spacing: -0.03em;
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
  font-size: 7px;
  opacity: 0.88;
}
</style>
