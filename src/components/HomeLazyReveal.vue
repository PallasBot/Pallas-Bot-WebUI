<script setup lang="ts">
import { computed } from "vue";
import HomeChartPanelSkeleton from "@/components/HomeChartPanelSkeleton.vue";

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    variant?:
      | "stats-4"
      | "stats-5"
      | "account-social"
      | "charts"
      | "chart-panel"
      | "metric-4"
      | "version-dl"
      | "shard-kpis";
    stagger?: boolean;
    ariaLabel?: string;
  }>(),
  {
    loading: false,
    variant: "stats-4",
    stagger: true,
    ariaLabel: "加载中",
  },
);

const statCounts: Record<string, number> = {
  "stats-4": 4,
  "stats-5": 5,
  "shard-kpis": 4,
};

const bodyClass = computed(() => ({
  "home-lazy-reveal__body--stagger": props.stagger && props.variant !== "account-social",
  "home-lazy-reveal__body--stagger-account": props.stagger && props.variant === "account-social",
}));
</script>

<template>
  <div
    class="home-lazy-reveal"
    :aria-busy="loading || undefined"
    :aria-label="loading ? ariaLabel : undefined"
  >
    <Transition
      name="home-lazy-cross"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="home-lazy-reveal__placeholder"
      >
        <div
          v-if="variant === 'account-social'"
          class="home-lazy-skel home-lazy-skel--account-social"
        >
          <div class="home-lazy-skel__chip-row home-lazy-skel__chip-row--social">
            <div
              v-for="n in 2"
              :key="`chip-social-${n}`"
              class="home-lazy-skel__chip skel-pulse"
            >
              <div class="home-lazy-skel__chip-label" />
              <div class="home-lazy-skel__chip-value" />
            </div>
          </div>
          <div class="home-lazy-skel__chip-row home-lazy-skel__chip-row--traffic">
            <div
              v-for="n in 2"
              :key="`chip-traffic-${n}`"
              class="home-lazy-skel__chip skel-pulse"
            >
              <div class="home-lazy-skel__chip-label" />
              <div class="home-lazy-skel__chip-value" />
            </div>
          </div>
          <div class="home-lazy-skel__pending-row">
            <div
              v-for="n in 2"
              :key="`pending-${n}`"
              class="home-lazy-skel__pending-card skel-pulse"
            >
              <div class="home-lazy-skel__pending-title" />
              <div class="home-lazy-skel__pending-value" />
            </div>
          </div>
        </div>

        <HomeChartPanelSkeleton v-else-if="variant === 'chart-panel'" />

        <div
          v-else-if="variant === 'charts'"
          class="home-lazy-skel home-lazy-skel--charts-shell"
        >
          <div class="home-lazy-skel__charts-toolbar skel-pulse" />
          <HomeChartPanelSkeleton tall />
        </div>

        <div
          v-else-if="variant === 'metric-4'"
          class="home-lazy-skel home-lazy-skel--metric-grid"
        >
          <div
            v-for="n in 4"
            :key="`metric-${n}`"
            class="home-lazy-skel__metric skel-pulse"
          />
        </div>

        <div
          v-else-if="variant === 'version-dl'"
          class="home-lazy-skel home-lazy-skel--version-dl"
        >
          <div
            v-for="n in 6"
            :key="`ver-${n}`"
            class="home-lazy-skel__version-row skel-pulse"
          />
        </div>

        <div
          v-else
          class="home-lazy-skel home-lazy-skel--stats-grid"
          :class="`home-lazy-skel--stats-grid-${statCounts[variant] ?? 4}`"
        >
          <div
            v-for="n in statCounts[variant] ?? 4"
            :key="`stat-${n}`"
            class="home-lazy-skel__stat-card skel-pulse"
          >
            <div class="home-lazy-skel__stat-label" />
            <div class="home-lazy-skel__stat-value" />
            <div class="home-lazy-skel__stat-hint" />
          </div>
        </div>
      </div>

      <div
        v-else
        key="ready"
        class="home-lazy-reveal__body"
        :class="bodyClass"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
