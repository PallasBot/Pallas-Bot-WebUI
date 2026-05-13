<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
}>();
</script>

<template>
  <div class="card stat-card">
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
