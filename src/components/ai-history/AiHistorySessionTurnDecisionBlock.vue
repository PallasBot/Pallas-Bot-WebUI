<script setup lang="ts">
withDefaults(
  defineProps<{
    summary: string;
    opportunityClass?: string;
    opportunityLabel?: string;
    timestampLabel?: string;
    highlights?: ReadonlyArray<{ label: string; value: string }>;
  }>(),
  {
    opportunityClass: "",
    opportunityLabel: "",
    timestampLabel: "",
    highlights: () => [],
  },
);
</script>

<template>
  <div class="ai-history-page__turn-decision">
    <div class="ai-history-page__turn-behavior-bar">
      <span class="ai-history-page__turn-behavior-tag">判定</span>
      <strong>{{ summary }}</strong>
      <span
        v-if="opportunityLabel"
        class="ai-history-page__outcome-badge"
        :class="opportunityClass"
      >
        {{ opportunityLabel }}
      </span>
      <span
        v-if="timestampLabel"
        class="muted"
      >
        {{ timestampLabel }}
      </span>
    </div>
    <div
      v-if="highlights.length"
      class="ai-history-page__trace-highlights"
    >
      <span
        v-for="item in highlights"
        :key="`${item.label}:${item.value}`"
      >
        {{ item.label }}：{{ item.value }}
      </span>
    </div>
  </div>
</template>
