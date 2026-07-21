<script setup lang="ts">
import { computed, ref, watch } from "vue";

type TrendPoint = {
  date: string;
  value: number;
};

type TrendSeries = {
  id: string;
  label: string;
  color: string;
  unit?: string;
  style?: "line" | "bar";
  points: TrendPoint[];
};

const props = withDefaults(
  defineProps<{
    series: TrendSeries[];
    emptyText?: string;
    summary?: string[];
    ariaLabel?: string;
  }>(),
  {
    emptyText: "所选范围暂无持久化数据",
    summary: () => [],
    ariaLabel: "AI 按日趋势图",
  },
);

const plotRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const hoverIndex = ref<number | null>(null);
const tooltipX = ref(0);

const pack = computed(() => {
  const normalized = props.series
    .map((series) => ({
      ...series,
      style: series.style ?? "line",
      points: series.points
        .filter((point) => point.date)
        .map((point) => ({
          date: point.date,
          value: Math.max(0, Number(point.value) || 0),
        })),
    }))
    .filter((series) => series.points.length > 0);
  if (!normalized.length) return null;
  const len = normalized[0]?.points.length ?? 0;
  if (!len) return null;
  const dates = normalized[0]!.points.map((point) => point.date);
  const W = 640;
  const H = 220;
  const padL = 42;
  const padR = 14;
  const padT = 16;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxValue = Math.max(1, ...normalized.flatMap((series) => series.points.map((point) => point.value)));
  const xAt = (index: number) => {
    if (len <= 1) return padL + innerW / 2;
    return padL + (innerW * index) / (len - 1);
  };
  const yAt = (value: number) => padT + innerH - (value / maxValue) * innerH;
  const barSeries = normalized.filter((series) => series.style === "bar");
  const slotWidth = len <= 1 ? innerW : innerW / len;
  const barWidth = Math.max(8, Math.min(20, (slotWidth * 0.64) / Math.max(1, barSeries.length)));
  const plotted = normalized.map((series) => {
    const barIndex = barSeries.findIndex((item) => item.id === series.id);
    const points = series.points.map((point, index) => ({
      ...point,
      x: xAt(index),
      y: yAt(point.value),
      barX:
        xAt(index) -
        (barWidth * Math.max(1, barSeries.length)) / 2 +
        Math.max(0, barIndex) * barWidth,
      barY: yAt(point.value),
      barH: padT + innerH - yAt(point.value),
      barW: len <= 1 ? 28 : barWidth,
    }));
    const pathD = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const areaD = `${pathD} L ${points[points.length - 1]!.x} ${padT + innerH} L ${points[0]!.x} ${padT + innerH} Z`;
    return {
      ...series,
      points,
      pathD,
      areaD,
    };
  });
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + innerH - innerH * ratio,
    t: fmtTick(maxValue * ratio),
  }));
  const xTicks = pickTickIndices(len, 10).map((index) => ({
    x: xAt(index),
    t: dates[index]!.slice(5),
  }));
  return {
    W,
    H,
    padL,
    padT,
    innerW,
    innerH,
    bottom: padT + innerH,
    plotted,
    dates,
    xAt,
    yTicks,
    xTicks,
  };
});

watch(
  () => props.series,
  () => {
    hoverIndex.value = null;
  },
  { deep: true },
);

const hoverDate = computed(() => {
  if (hoverIndex.value == null || !pack.value) return "";
  return pack.value.dates[hoverIndex.value] ?? "";
});

const hoverRows = computed(() => {
  if (hoverIndex.value == null || !pack.value) return [];
  const activeIndex = hoverIndex.value;
  return pack.value.plotted.map((series) => ({
    id: series.id,
    label: series.label,
    color: series.color,
    unit: series.unit,
    value: series.points[activeIndex]?.value ?? 0,
  }));
});

function fmtTick(value: number): string {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

function pickTickIndices(length: number, maxTicks: number): number[] {
  if (length <= 1) return [0];
  if (length <= maxTicks) return Array.from({ length }, (_, index) => index);
  const out: number[] = [0];
  const step = (length - 1) / (maxTicks - 1);
  for (let index = 1; index < maxTicks - 1; index += 1) {
    out.push(Math.min(length - 1, Math.round(index * step)));
  }
  out.push(length - 1);
  return [...new Set(out)].sort((a, b) => a - b);
}

function onPlotMove(event: PointerEvent) {
  const svg = svgRef.value;
  const currentPack = pack.value;
  const wrap = plotRef.value;
  if (!svg || !currentPack || !wrap) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const svgPoint = point.matrixTransform(ctm.inverse());
  const ratio = (svgPoint.x - currentPack.padL) / currentPack.innerW;
  const idx = Math.round(ratio * (currentPack.dates.length - 1));
  hoverIndex.value = Math.max(0, Math.min(currentPack.dates.length - 1, idx));
  const rect = wrap.getBoundingClientRect();
  tooltipX.value = Math.max(12, Math.min(rect.width - 12, event.clientX - rect.left));
}

function onPlotLeave() {
  hoverIndex.value = null;
}
</script>

<template>
  <div class="ai-daily-trend">
    <div v-if="summary.length" class="ai-daily-trend__summary muted">
      <span v-for="item in summary" :key="item">{{ item }}</span>
    </div>
    <p v-if="!pack" class="muted ai-daily-trend__empty">{{ emptyText }}</p>
    <template v-else>
      <div
        ref="plotRef"
        class="ai-daily-trend__plot"
        @pointermove="onPlotMove"
        @pointerleave="onPlotLeave"
      >
        <svg
          ref="svgRef"
          class="ai-daily-trend__svg"
          :viewBox="`0 0 ${pack.W} ${pack.H}`"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          :aria-label="ariaLabel"
        >
          <defs>
            <linearGradient
              v-for="series in pack.plotted"
              :id="`ai-trend-area-${series.id}`"
              :key="`grad-${series.id}`"
              gradientUnits="userSpaceOnUse"
              :x1="pack.padL"
              :y1="pack.bottom"
              :x2="pack.padL"
              :y2="pack.padT"
            >
              <stop offset="0%" :stop-color="series.color" stop-opacity="0" />
              <stop offset="100%" :stop-color="series.color" stop-opacity="0.18" />
            </linearGradient>
          </defs>

          <line
            v-for="(tick, index) in pack.yTicks"
            :key="`grid-${index}`"
            class="ai-daily-trend__grid"
            :x1="pack.padL"
            :y1="tick.y"
            :x2="pack.padL + pack.innerW"
            :y2="tick.y"
          />

          <text
            v-for="(tick, index) in pack.yTicks"
            :key="`yt-${index}`"
            class="ai-daily-trend__axis"
            :x="6"
            :y="tick.y + 4"
          >
            {{ tick.t }}
          </text>

          <text
            v-for="(tick, index) in pack.xTicks"
            :key="`xt-${index}`"
            class="ai-daily-trend__axis ai-daily-trend__axis--x"
            :x="tick.x"
            :y="pack.H - 10"
          >
            {{ tick.t }}
          </text>

          <path
            v-for="series in pack.plotted.filter((item) => item.style === 'line')"
            :key="`area-${series.id}`"
            class="ai-daily-trend__area"
            :d="series.areaD"
            :fill="`url(#ai-trend-area-${series.id})`"
          />
          <template v-for="series in pack.plotted.filter((item) => item.style === 'bar')" :key="`bars-${series.id}`">
            <rect
              v-for="point in series.points"
              :key="`${series.id}-${point.date}`"
              class="ai-daily-trend__bar"
              :x="point.barX"
              :y="point.barY"
              :width="Math.max(2, point.barW)"
              :height="Math.max(0, point.barH)"
              :fill="series.color"
              :rx="4"
              :opacity="0.72"
            />
          </template>
          <path
            v-for="series in pack.plotted.filter((item) => item.style === 'line')"
            :key="`line-${series.id}`"
            class="ai-daily-trend__line"
            :d="series.pathD"
            fill="none"
            :stroke="series.color"
          />

          <line
            v-if="hoverIndex != null"
            class="ai-daily-trend__cursor"
            :x1="pack.xAt(hoverIndex)"
            :y1="pack.padT"
            :x2="pack.xAt(hoverIndex)"
            :y2="pack.bottom"
          />

          <template v-for="series in pack.plotted.filter((item) => item.style === 'line')" :key="`dots-${series.id}`">
            <circle
              v-for="(point, index) in series.points"
              :key="`${series.id}-${point.date}`"
              class="ai-daily-trend__dot"
              :class="{ 'ai-daily-trend__dot--active': hoverIndex === index }"
              :cx="point.x"
              :cy="point.y"
              :r="hoverIndex === index ? 5.5 : 3.5"
              :fill="series.color"
            />
          </template>
        </svg>

        <div
          v-if="hoverRows.length"
          class="ai-daily-trend__tooltip"
          :style="{ left: `${tooltipX}px` }"
        >
          <div class="ai-daily-trend__tooltip-date">{{ hoverDate }}</div>
          <div v-for="row in hoverRows" :key="row.id" class="ai-daily-trend__tooltip-row">
            <i class="ai-daily-trend__tooltip-dot" :style="{ background: row.color }" />
            <span class="ai-daily-trend__tooltip-label">{{ row.label }}</span>
            <span class="ai-daily-trend__tooltip-val">{{ row.value.toLocaleString() }}{{ row.unit ? ` ${row.unit}` : "" }}</span>
          </div>
        </div>
      </div>

      <div class="ai-daily-trend__legend muted">
        <span v-for="series in pack.plotted" :key="`legend-${series.id}`" class="ai-daily-trend__legend-item">
          <i class="ai-daily-trend__legend-swatch" :style="{ background: series.color }" />
          {{ series.label }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ai-daily-trend {
  min-width: 0;
}

.ai-daily-trend__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 10px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.ai-daily-trend__empty {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
}

.ai-daily-trend__plot {
  position: relative;
  width: 100%;
  min-width: 0;
  touch-action: none;
}

.ai-daily-trend__svg {
  display: block;
  width: 100%;
  height: auto;
}

.ai-daily-trend__grid {
  stroke: color-mix(in srgb, var(--border) 88%, transparent);
  stroke-width: 1;
}

.ai-daily-trend__axis {
  fill: var(--text-muted);
  font-size: 11px;
}

.ai-daily-trend__axis--x {
  text-anchor: middle;
}

.ai-daily-trend__area {
  pointer-events: none;
}

.ai-daily-trend__bar {
  transform-origin: bottom center;
  animation: ai-daily-bar-in 0.32s ease;
}

.ai-daily-trend__line {
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ai-daily-trend__cursor {
  stroke: color-mix(in srgb, var(--text-muted) 44%, transparent);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.ai-daily-trend__dot {
  transition: r 0.16s ease;
}

.ai-daily-trend__tooltip {
  position: absolute;
  top: 10px;
  transform: translateX(-50%);
  min-width: 170px;
  max-width: min(240px, calc(100vw - 32px));
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel) 88%, white 12%);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(12px);
}

.ai-daily-trend__tooltip-date {
  margin-bottom: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text);
}

.ai-daily-trend__tooltip-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.ai-daily-trend__tooltip-dot,
.ai-daily-trend__legend-swatch {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.ai-daily-trend__tooltip-label {
  min-width: 0;
  color: var(--text-muted);
}

.ai-daily-trend__tooltip-val {
  font-weight: 700;
  color: var(--text);
}

.ai-daily-trend__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  font-size: 0.75rem;
}

.ai-daily-trend__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 560px) {
  .ai-daily-trend__summary {
    gap: 6px 12px;
    font-size: 0.75rem;
  }

  .ai-daily-trend__tooltip {
    min-width: 150px;
    max-width: calc(100vw - 24px);
    padding: 9px 10px;
  }
}

@keyframes ai-daily-bar-in {
  from {
    opacity: 0.25;
    transform: scaleY(0.35);
  }
  to {
    opacity: 0.72;
    transform: scaleY(1);
  }
}
</style>
