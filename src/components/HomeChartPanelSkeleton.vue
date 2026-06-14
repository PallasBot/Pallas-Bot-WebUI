<script setup lang="ts">
withDefaults(
  defineProps<{
    tall?: boolean;
  }>(),
  {
    tall: false,
  },
);
</script>

<template>
  <div
    class="home-lazy-skel home-lazy-skel--chart-panel"
    :class="{ 'home-lazy-skel--chart-panel--tall': tall }"
    role="status"
    aria-label="加载中"
  >
    <div class="home-lazy-skel__chart-toolbar skel-pulse" />
    <div class="home-lazy-skel__chart-bars">
      <div
        v-for="n in 6"
        :key="`bar-${n}`"
        class="home-lazy-skel__chart-bar skel-pulse"
        :style="{ '--bar-h': `${28 + (n % 4) * 14}%` }"
      />
    </div>
    <div class="home-lazy-skel__chart-axis skel-pulse" />
  </div>
</template>
