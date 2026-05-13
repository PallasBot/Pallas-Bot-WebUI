<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  /** 更小的内边距与数值，用于仪表盘等密集布局 */
  dense?: boolean;
}>();
</script>

<template>
  <div
    class="card stat-card"
    :class="{ 'stat-card--dense': dense }"
  >
    <div class="card__body">
      <div class="stat-card__label">{{ label }}</div>
      <div class="stat-card__value">{{ value }}</div>
      <div
        v-if="hint"
        class="stat-card__hint"
      >
        {{ hint }}
      </div>
    </div>
  </div>
</template>
