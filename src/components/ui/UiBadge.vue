<script setup lang="ts">
export type UiBadgeVariant = "default" | "secondary" | "outline" | "ok" | "warn" | "muted" | "destructive";

withDefaults(
  defineProps<{
    variant?: UiBadgeVariant;
  }>(),
  {
    variant: "secondary",
  },
);
</script>

<template>
  <span
    class="ui-badge"
    :class="`ui-badge--${variant}`"
  >
    <slot />
  </span>
</template>
