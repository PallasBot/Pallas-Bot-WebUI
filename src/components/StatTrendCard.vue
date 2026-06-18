<script setup lang="ts">
import { computed } from "vue";
import UiCard from "@/components/ui/UiCard.vue";
import { buildSparkBars, buildSparkGeometry } from "@/utils/sparkline";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    hint?: string;
    hintTitle?: string;
    dense?: boolean;
    sparkValues?: number[];
    chartMode?: "line" | "bar";
    chartVariant?: "msg" | "api" | "matcher" | "ai";
  }>(),
  {
    chartMode: "line",
    chartVariant: "msg",
  },
);

const hasChart = computed(() => (props.sparkValues?.length ?? 0) >= 2);

const lineGeom = computed(() =>
  props.chartMode === "line" && hasChart.value
    ? buildSparkGeometry(props.sparkValues ?? [])
    : undefined,
);

const bars = computed(() =>
  props.chartMode === "bar" && (props.sparkValues?.length ?? 0) >= 1
    ? buildSparkBars(props.sparkValues ?? [])
    : [],
);
</script>

<template>
  <UiCard
    tag="div"
    glass
    interactive
    class="stat-trend-card"
    :class="[
      { 'stat-trend-card--dense': dense },
      hasChart || bars.length ? 'stat-trend-card--has-chart' : '',
      `stat-trend-card--${chartVariant}`,
    ]"
  >
    <div class="stat-trend-card__body">
      <div class="stat-trend-card__head">
        <div class="stat-trend-card__label">{{ label }}</div>
        <div class="stat-trend-card__value">{{ value }}</div>
      </div>
      <div
        v-if="hint"
        class="stat-trend-card__hint"
        :title="hintTitle || undefined"
      >
        {{ hint }}
      </div>
      <svg
        v-if="lineGeom"
        class="stat-trend-card__chart stat-trend-card__chart--line"
        viewBox="0 0 160 48"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          class="stat-trend-card__area"
          :d="lineGeom.area"
        />
        <polyline
          class="stat-trend-card__line"
          :points="lineGeom.poly"
        />
      </svg>
      <svg
        v-else-if="bars.length"
        class="stat-trend-card__chart stat-trend-card__chart--bar"
        viewBox="0 0 160 48"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          v-for="(bar, i) in bars"
          :key="i"
          class="stat-trend-card__bar"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          rx="1"
        />
      </svg>
    </div>
  </UiCard>
</template>
