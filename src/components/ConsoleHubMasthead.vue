<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
defineProps<{
  icon?: ConsoleNavIconId | string;
}>();
</script>

<template>
  <header class="console-hub-page__masthead">
    <div class="console-hub-page__masthead-main">
      <h2 class="console-hub-page__title">
        <ConsoleNavIcon
          v-if="icon"
          class="panel__title-ico"
          :name="icon"
          :size="26"
        />
        <slot name="title" />
      </h2>
      <div
        v-if="$slots.lead"
        class="console-hub-page__lead muted"
      >
        <slot name="lead" />
      </div>
      <slot name="extra" />
    </div>
    <div
      v-if="$slots.actions"
      class="row-actions console-hub-page__masthead-actions"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
