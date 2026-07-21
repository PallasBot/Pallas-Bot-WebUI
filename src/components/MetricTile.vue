<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

withDefaults(
  defineProps<{
    label: string;
    icon?: ConsoleNavIconId | string;
    value?: string;
  }>(),
  {
    icon: undefined,
    value: "",
  },
);
</script>

<template>
  <div class="metric-tile">
    <div class="metric-tile__head">
      <ConsoleNavIcon
        v-if="icon"
        class="metric-tile__ico"
        :name="icon"
        :size="16"
      />
      <span class="metric-tile__label">{{ label }}</span>
    </div>
    <div class="metric-tile__value-slot">
      <slot>
        <span class="metric-tile__value">{{ value }}</span>
      </slot>
    </div>
  </div>
</template>
